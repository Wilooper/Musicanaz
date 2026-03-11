/**
 * Party WebRTC data-channel manager
 *
 * The host acts as a signaling hub.  When a guest opens a party page they:
 *  1. Call `init()` — registers with the signaling API and starts polling for
 *     incoming signals.
 *  2. For each new peer discovered, a RTCPeerConnection + data channel is
 *     established through the `/api/party` signal/getSignals actions.
 *
 * Messages sent over the data channel are JSON objects with a `type` field:
 *   { type: "chat",     payload: ChatMsg }
 *   { type: "reaction", payload: { emoji, user } }
 *   { type: "queue",    payload: Song[] }
 *   { type: "song",     payload: Song | null }
 *   { type: "votes",    payload: VoteData[] }
 *
 * If the WebRTC connection fails the caller falls back to HTTP polling
 * (existing behaviour — nothing needs to change there).
 */

export type RTCMessageType = "chat" | "reaction" | "queue" | "song" | "votes"

export interface RTCMessage {
  type:    RTCMessageType
  payload: any
}

export type MessageHandler = (msg: RTCMessage) => void

const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  {
    urls:       "turn:openrelay.metered.ca:80",
    username:   "openrelayproject",
    credential: "openrelayproject",
  },
]

const SIGNAL_POLL_MS = 2000   // how often to check for new signals
const MAX_RETRIES    = 3       // number of times to retry a failed connection

interface PeerEntry {
  pc:      RTCPeerConnection
  dc:      RTCDataChannel | null
  retries: number
}

export class PartyRTC {
  private partyId:   string
  private selfId:    string
  private peers:     Map<string, PeerEntry> = new Map()
  private onMessage: MessageHandler
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private destroyed  = false

  constructor(partyId: string, selfId: string, onMessage: MessageHandler) {
    this.partyId   = partyId
    this.selfId    = selfId
    this.onMessage = onMessage
  }

  // ── Public API ──────────────────────────────────────────────

  /** Start polling for signals and connecting to any known peers. */
  start() {
    if (this.destroyed) return
    this.pollSignals()
    this.pollTimer = setInterval(() => this.pollSignals(), SIGNAL_POLL_MS)
  }

  /** Broadcast a message to all connected peers. */
  broadcast(msg: RTCMessage) {
    const raw = JSON.stringify(msg)
    for (const { dc } of this.peers.values()) {
      if (dc && dc.readyState === "open") {
        try { dc.send(raw) } catch {}
      }
    }
  }

  /** Send a message to a specific peer. */
  sendTo(peerId: string, msg: RTCMessage) {
    const entry = this.peers.get(peerId)
    if (entry?.dc?.readyState === "open") {
      try { entry.dc.send(JSON.stringify(msg)) } catch {}
    }
  }

  /** Return true if we have at least one open data channel. */
  get isConnected(): boolean {
    for (const { dc } of this.peers.values()) {
      if (dc?.readyState === "open") return true
    }
    return false
  }

  /** Clean up all connections. */
  destroy() {
    this.destroyed = true
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = null }
    for (const { pc, dc } of this.peers.values()) {
      try { dc?.close() } catch {}
      try { pc.close()  } catch {}
    }
    this.peers.clear()
  }

  // ── Internal helpers ────────────────────────────────────────

  /** Initiate an offer to a new peer (we are the caller). */
  private async initiateConnection(peerId: string) {
    if (this.destroyed || this.peers.has(peerId)) return
    const entry = this.createPeerEntry(peerId)
    // Caller creates the data channel
    const dc = entry.pc.createDataChannel("party", { ordered: true })
    entry.dc = dc
    this.wireDataChannel(dc)

    try {
      const offer = await entry.pc.createOffer()
      await entry.pc.setLocalDescription(offer)
      await this.waitForIceGathering(entry.pc)
      await this.sendSignal(peerId, entry.pc.localDescription)
    } catch (err) {
      this.handleConnectionError(peerId, entry, err)
    }
  }

  /** Handle an incoming offer or answer signal. */
  private async handleSignal(from: string, data: any) {
    if (this.destroyed) return
    if (data.type === "offer") {
      await this.handleOffer(from, data as RTCSessionDescriptionInit)
    } else if (data.type === "answer") {
      await this.handleAnswer(from, data as RTCSessionDescriptionInit)
    } else if (data.candidate !== undefined) {
      await this.handleIceCandidate(from, data as RTCIceCandidateInit)
    }
  }

  private async handleOffer(from: string, offer: RTCSessionDescriptionInit) {
    let entry = this.peers.get(from)
    if (!entry) entry = this.createPeerEntry(from)

    entry.pc.ondatachannel = (ev) => {
      entry!.dc = ev.channel
      this.wireDataChannel(ev.channel)
    }

    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(offer))
      const answer = await entry.pc.createAnswer()
      await entry.pc.setLocalDescription(answer)
      await this.waitForIceGathering(entry.pc)
      await this.sendSignal(from, entry.pc.localDescription)
    } catch (err) {
      this.handleConnectionError(from, entry, err)
    }
  }

  private async handleAnswer(from: string, answer: RTCSessionDescriptionInit) {
    const entry = this.peers.get(from)
    if (!entry) return
    try {
      await entry.pc.setRemoteDescription(new RTCSessionDescription(answer))
    } catch (err) {
      this.handleConnectionError(from, entry, err)
    }
  }

  private async handleIceCandidate(from: string, init: RTCIceCandidateInit) {
    const entry = this.peers.get(from)
    if (!entry) return
    try {
      if (entry.pc.remoteDescription) {
        await entry.pc.addIceCandidate(new RTCIceCandidate(init))
      }
    } catch {}
  }

  private createPeerEntry(peerId: string): PeerEntry {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS })

    pc.onicecandidate = async (ev) => {
      if (ev.candidate) {
        await this.sendSignal(peerId, ev.candidate.toJSON())
      }
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        const entry = this.peers.get(peerId)
        if (entry) this.handleConnectionError(peerId, entry, new Error("Connection failed"))
      }
    }

    const entry: PeerEntry = { pc, dc: null, retries: 0 }
    this.peers.set(peerId, entry)
    return entry
  }

  private wireDataChannel(dc: RTCDataChannel) {
    dc.onmessage = (ev) => {
      try {
        const msg: RTCMessage = JSON.parse(ev.data)
        this.onMessage(msg)
      } catch {}
    }
    dc.onerror = () => {}
  }

  private handleConnectionError(peerId: string, entry: PeerEntry, _err: any) {
    if (this.destroyed) return
    try { entry.dc?.close() } catch {}
    try { entry.pc.close()  } catch {}
    this.peers.delete(peerId)

    if (entry.retries < MAX_RETRIES) {
      const delay = (entry.retries + 1) * 2000
      const nextRetries = entry.retries + 1
      setTimeout(() => {
        if (!this.destroyed && !this.peers.has(peerId)) {
          const newEntry = this.createPeerEntry(peerId)
          newEntry.retries = nextRetries
          this.initiateConnection(peerId).catch(() => {})
        }
      }, delay)
    }
    // After MAX_RETRIES, silently give up — HTTP polling acts as fallback
  }

  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") { resolve(); return }
      const onStateChange = () => {
        if (pc.iceGatheringState === "complete") {
          pc.removeEventListener("icegatheringstatechange", onStateChange)
          resolve()
        }
      }
      pc.addEventListener("icegatheringstatechange", onStateChange)
      // Safety timeout — don't wait forever
      setTimeout(resolve, 3000)
    })
  }

  // ── Signaling via /api/party ─────────────────────────────────

  private async sendSignal(to: string, data: any) {
    try {
      await fetch("/api/party", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          action:     "signal",
          partyId:    this.partyId,
          guestId:    this.selfId,
          signalTo:   to,
          signalData: data,
        }),
      })
    } catch {}
  }

  private async pollSignals() {
    if (this.destroyed) return
    try {
      const res = await fetch("/api/party", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          action:  "getSignals",
          partyId: this.partyId,
          guestId: this.selfId,
        }),
      })
      if (!res.ok) return
      const { signals } = await res.json()
      if (Array.isArray(signals)) {
        for (const sig of signals) {
          await this.handleSignal(sig.from, sig.data)
        }
      }
    } catch {}
  }

  /** Call this when you learn about a new peer (e.g. from the guests list). */
  connectToPeer(peerId: string) {
    if (peerId === this.selfId || this.peers.has(peerId)) return
    this.initiateConnection(peerId)
  }
}
