import { NextRequest, NextResponse } from "next/server"

// ─── In-memory party store (resets on cold start — fine for demo) ──
interface ReplyRef    { id: string; user: string; text: string }
interface ChatMessage { id: string; user: string; text: string; ts: number; replyTo?: ReplyRef }
interface Vote        { songId: string; voters: string[] }
interface Guest       { id: string; name: string; joinedAt: number }
interface Signal      { from: string; to: string; data: any; ts: number }
interface PartyState {
  hostId:       string
  queue:        any[]
  chat:         ChatMessage[]
  votes:        Vote[]
  reactions:    { user: string; emoji: string; ts: number }[]
  guests:       Guest[]
  kickedGuests: string[]
  signals:      Signal[]
  createdAt:    number
}

const parties: Map<string, PartyState> = new Map()

// Clean up parties older than 3 hours
function cleanup() {
  const threshold = Date.now() - 3 * 60 * 60 * 1000
  for (const [id, p] of parties.entries()) {
    if (p.createdAt < threshold) parties.delete(id)
  }
}

// ─── GET /api/party?id=xxx  — get party state
// ─── POST /api/party — create party or send action
export async function GET(req: NextRequest) {
  cleanup()
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  const party = parties.get(id)
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 })
  return NextResponse.json({
    hostId:       party.hostId,
    queue:        party.queue,
    chat:         party.chat,
    votes:        party.votes,
    reactions:    party.reactions,
    guests:       party.guests,
    kickedGuests: party.kickedGuests,
    createdAt:    party.createdAt,
  })
}

export async function POST(req: NextRequest) {
  cleanup()
  const body = await req.json().catch(() => ({}))
  const { action, partyId, guestId, song, text, emoji, songId, messageId, username, replyTo, signalTo, signalData } = body

  // ── Create party ──
  if (action === "create") {
    const id = Math.random().toString(36).slice(2, 9).toUpperCase()
    parties.set(id, {
      hostId:       guestId || "host",
      queue:        [],
      chat:         [],
      votes:        [],
      reactions:    [],
      guests:       [],
      kickedGuests: [],
      signals:      [],
      createdAt:    Date.now(),
    })
    return NextResponse.json({ partyId: id })
  }

  const party = parties.get(partyId)
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 })

  // ── Guest join — register / update guest ──
  if (action === "join") {
    const name = String(username || guestId || "Guest").slice(0, 40)
    const existing = party.guests.find(g => g.id === guestId)
    if (!existing) {
      party.guests.push({ id: guestId, name, joinedAt: Date.now() })
    } else {
      existing.name = name
    }
    return NextResponse.json({
      ok:           true,
      hostId:       party.hostId,
      kickedGuests: party.kickedGuests,
      guests:       party.guests,
    })
  }

  // ── Check if guest is kicked ──
  if (party.kickedGuests.includes(guestId)) {
    return NextResponse.json({ error: "You have been removed from this party", kicked: true }, { status: 403 })
  }

  // ── Add song to queue ──
  if (action === "addSong" && song) {
    if (!party.queue.find((s: any) => s.id === song.id)) {
      party.queue.push({ ...song, addedBy: guestId, guestName: String(username || guestId || "Guest").slice(0, 40), addedAt: Date.now() })
    }
    return NextResponse.json({ ok: true, queue: party.queue })
  }

  // ── Remove song from queue (host only) ──
  if (action === "removeSong" && songId) {
    if (guestId !== party.hostId) return NextResponse.json({ error: "Only the host can remove songs" }, { status: 403 })
    party.queue = party.queue.filter((s: any) => s.id !== songId)
    return NextResponse.json({ ok: true, queue: party.queue })
  }

  // ── Vote for song ──
  if (action === "vote" && songId) {
    let vote = party.votes.find(v => v.songId === songId)
    if (!vote) { vote = { songId, voters: [] }; party.votes.push(vote) }
    if (!vote.voters.includes(guestId)) vote.voters.push(guestId)
    return NextResponse.json({ ok: true, votes: party.votes })
  }

  // ── Send chat message ──
  if (action === "chat" && text) {
    const msg: ChatMessage = {
      id:      Math.random().toString(36).slice(2, 9),
      user:    String(username || guestId || "Guest").slice(0, 40),
      text:    String(text).slice(0, 200),
      ts:      Date.now(),
      replyTo: replyTo && replyTo.id ? { id: replyTo.id, user: String(replyTo.user || "").slice(0, 40), text: String(replyTo.text || "").slice(0, 100) } : undefined,
    }
    party.chat.push(msg)
    if (party.chat.length > 100) party.chat = party.chat.slice(-100)
    return NextResponse.json({ ok: true, chat: party.chat })
  }

  // ── Delete chat message ──
  if (action === "deleteChat" && messageId) {
    const msg = party.chat.find(m => m.id === messageId)
    if (!msg) return NextResponse.json({ error: "Message not found" }, { status: 404 })
    const isAuthor = msg.user === String(username || guestId || "")
    const isHost   = guestId === party.hostId
    if (!isAuthor && !isHost) return NextResponse.json({ error: "Not allowed to delete this message" }, { status: 403 })
    party.chat = party.chat.filter(m => m.id !== messageId)
    return NextResponse.json({ ok: true, chat: party.chat })
  }

  // ── Send reaction ──
  if (action === "react" && emoji) {
    party.reactions.push({ user: String(username || guestId || "Guest"), emoji, ts: Date.now() })
    if (party.reactions.length > 200) party.reactions = party.reactions.slice(-200)
    return NextResponse.json({ ok: true, reactions: party.reactions })
  }

  // ── Kick guest (host only) ──
  if (action === "kick") {
    const kickId = body.kickGuestId
    if (!kickId) return NextResponse.json({ error: "Missing kickGuestId" }, { status: 400 })
    if (guestId !== party.hostId) return NextResponse.json({ error: "Only the host can kick guests" }, { status: 403 })
    if (!party.kickedGuests.includes(kickId)) party.kickedGuests.push(kickId)
    party.guests = party.guests.filter(g => g.id !== kickId)
    return NextResponse.json({ ok: true, guests: party.guests, kickedGuests: party.kickedGuests })
  }

  // ── WebRTC signal ──
  if (action === "signal" && signalTo && signalData) {
    const sig: Signal = { from: guestId, to: signalTo, data: signalData, ts: Date.now() }
    party.signals.push(sig)
    // Keep only last 200 signals to avoid unbounded growth
    if (party.signals.length > 200) party.signals = party.signals.slice(-200)
    return NextResponse.json({ ok: true })
  }

  // ── Get pending WebRTC signals for this peer ──
  if (action === "getSignals") {
    const pending = party.signals.filter(s => s.to === guestId)
    // Remove consumed signals
    party.signals = party.signals.filter(s => s.to !== guestId)
    return NextResponse.json({ ok: true, signals: pending })
  }

  // ── Host: mark song as played (shift queue) ──
  if (action === "popQueue") {
    if (guestId !== party.hostId) return NextResponse.json({ error: "Only the host can pop the queue" }, { status: 403 })
    party.queue.shift()
    return NextResponse.json({ ok: true, queue: party.queue })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
