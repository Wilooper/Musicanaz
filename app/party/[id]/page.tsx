"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  Search, Music, Plus, Loader2, Users, Check, MessageCircle,
  Send, ThumbsUp, Reply, Trash2, X, UserX, ListMusic,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getGuestId, getPartyUsername } from "@/lib/storage"
import { PartyRTC, type RTCMessage } from "@/lib/party-rtc"
import type { Song } from "@/lib/types"

const PARTY_SERVER = process.env.NEXT_PUBLIC_PARTY_SERVER || ""
const EMOJIS = ["🔥", "❤️", "😍", "🎵", "💃", "🙌", "🎉", "😮"]

interface ReplyRef { id: string; user: string; text: string }
interface ChatMsg  { id: string; user: string; text: string; ts: number; replyTo?: ReplyRef }
interface VoteData { songId: string; voters: string[] }
interface GuestInfo { id: string; name: string; joinedAt: number }

// ── Animated Equalizer for "Now Playing" ──────────────────────
function Equalizer({ playing }: { playing: boolean }) {
  return (
    <span className="flex items-end gap-[2px] h-4">
      {[1, 2, 3].map(i => (
        <span
          key={i}
          className={[
            "w-[3px] rounded-full bg-primary origin-bottom",
            playing ? "animate-bounce" : "",
          ].join(" ")}
          style={{
            height:         playing ? `${8 + i * 4}px` : "4px",
            animationDelay: `${i * 80}ms`,
            transition:     "height 0.3s",
          }}
        />
      ))}
    </span>
  )
}

// ── Quoted reply block ───────────────────────────────────────
function ReplyBlock({ reply, own }: { reply: ReplyRef; own: boolean }) {
  return (
    <div className={[
      "text-[10px] rounded-lg px-2 py-1 mb-1 border-l-2 opacity-80",
      own ? "border-primary-foreground/60 bg-primary-foreground/10 text-primary-foreground"
          : "border-primary/60 bg-primary/10 text-foreground",
    ].join(" ")}>
      <span className="font-bold">{reply.user}: </span>{reply.text}
    </div>
  )
}

export default function PartyGuestPage() {
  const { id }   = useParams()
  const router   = useRouter()
  const partyId  = typeof id === "string" ? id : ""
  const guestId  = getGuestId()
  const username = getPartyUsername()

  // Core state
  const [query,       setQuery]       = useState("")
  const [results,     setResults]     = useState<Song[]>([])
  const [searching,   setSearching]   = useState(false)
  const [addedIds,    setAddedIds]    = useState<Set<string>>(new Set())
  const [dupIds,      setDupIds]      = useState<Set<string>>(new Set())
  const [chat,        setChat]        = useState<ChatMsg[]>([])
  const [chatInput,   setChatInput]   = useState("")
  const [replyTo,     setReplyTo]     = useState<ReplyRef | null>(null)
  const [votes,       setVotes]       = useState<VoteData[]>([])
  const [queue,       setQueue]       = useState<Song[]>([])
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [isPlaying,   setIsPlaying]   = useState(false)
  const [guests,      setGuests]      = useState<GuestInfo[]>([])
  const [hostId,      setHostId]      = useState<string | null>(null)
  const [kicked,      setKicked]      = useState(false)
  // Reactions state: both local-triggered and received from other users
  const [reactions,   setReactions]   = useState<{ emoji: string; id: number; fromOther?: boolean }[]>([])
  // Tab — host gets an extra "members" tab
  const [activeTab,   setActiveTab]   = useState<"search" | "queue" | "chat" | "members">("search")
  // Track last seen reaction ts to detect new remote reactions
  const lastReactionTsRef = useRef<number>(0)

  const chatEndRef  = useRef<HTMLDivElement>(null)
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const rtcRef      = useRef<PartyRTC | null>(null)

  const isHost = hostId !== null && guestId === hostId

  // ── Sort queue by votes ──────────────────────────────────────
  const sortedQueue = [...queue].sort((a, b) => {
    const va = votes.find(v => v.songId === a.id)?.voters.length || 0
    const vb = votes.find(v => v.songId === b.id)?.voters.length || 0
    if (vb !== va) return vb - va
    // Tie-break by addedAt if available
    const ta = (a as any).addedAt || 0
    const tb = (b as any).addedAt || 0
    return ta - tb
  })

  const getVoteCount = (songId: string) => votes.find(v => v.songId === songId)?.voters.length || 0
  const hasVoted     = (songId: string) => votes.find(v => v.songId === songId)?.voters.includes(guestId) || false

  // ── WebRTC message handler ───────────────────────────────────
  const handleRTCMessage = useCallback((msg: RTCMessage) => {
    if (msg.type === "chat")     setChat(msg.payload)
    if (msg.type === "votes")    setVotes(msg.payload)
    if (msg.type === "queue")    setQueue(msg.payload)
    if (msg.type === "song")     setCurrentSong(msg.payload)
    if (msg.type === "reaction") {
      const { emoji } = msg.payload as { emoji: string; user: string }
      const newR = { emoji, id: Date.now() + Math.random(), fromOther: true }
      setReactions(prev => [...prev, newR])
      setTimeout(() => setReactions(prev => prev.filter(r => r.id !== newR.id)), 2500)
    }
  }, [])

  // ── Initialize WebRTC ────────────────────────────────────────
  useEffect(() => {
    if (!partyId || typeof window === "undefined") return
    const rtc = new PartyRTC(partyId, guestId, handleRTCMessage)
    rtcRef.current = rtc
    rtc.start()
    return () => { rtc.destroy(); rtcRef.current = null }
  }, [partyId, guestId, handleRTCMessage])

  // Connect to newly discovered peers
  useEffect(() => {
    if (!rtcRef.current) return
    guests.forEach(g => {
      if (g.id !== guestId) rtcRef.current?.connectToPeer(g.id)
    })
  }, [guests, guestId])

  // ── Join the party on mount ──────────────────────────────────
  useEffect(() => {
    if (!partyId) return
    // Register with local API
    fetch("/api/party", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "join", partyId, guestId, username }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return
        if (data.hostId)  setHostId(data.hostId)
        if (data.guests)  setGuests(data.guests)
      })
      .catch(() => {})
    // Join via external party server too (for queue/currentSong)
    if (PARTY_SERVER) {
      fetch(`${PARTY_SERVER}/party/${partyId}/join`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ guestName: username }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (!data) return
          setQueue(data.queue || [])
          setCurrentSong(data.currentSong || null)
        })
        .catch(() => {})
    }
  }, [partyId]) // username / guestId are stable — intentionally omitted

  // ── Poll party state every 3 seconds ────────────────────────
  const poll = useCallback(async () => {
    try {
      // External server — queue / currentSong
      if (PARTY_SERVER) {
        const extRes = await fetch(`${PARTY_SERVER}/party/${partyId}`)
        if (extRes.ok) {
          const extData = await extRes.json()
          setQueue(extData.queue || [])
          setCurrentSong(extData.currentSong || null)
          setIsPlaying(!!extData.isPlaying)
        }
      }
      // Local API — chat / votes / guests / reactions / kicked check
      const localRes = await fetch(`/api/party?id=${partyId}`)
      if (localRes.ok) {
        const d = await localRes.json()
        setChat(d.chat   || [])
        setVotes(d.votes || [])
        if (d.hostId) setHostId(d.hostId)
        if (d.guests) setGuests(d.guests)
        // Use local queue when available (has guestName, addedAt)
        if (d.queue && d.queue.length > 0) setQueue(d.queue)
        // Detect new reactions from other users
        if (Array.isArray(d.reactions)) {
          const newRemote = d.reactions.filter(
            (r: any) => r.ts > lastReactionTsRef.current && r.user !== username
          )
          if (newRemote.length > 0) {
            lastReactionTsRef.current = Math.max(...d.reactions.map((r: any) => r.ts))
            newRemote.forEach((r: any) => {
              const newR = { emoji: r.emoji, id: Date.now() + Math.random(), fromOther: true }
              setReactions(prev => [...prev, newR])
              setTimeout(() => setReactions(prev => prev.filter(x => x.id !== newR.id)), 2500)
            })
          } else if (d.reactions.length > 0 && lastReactionTsRef.current === 0) {
            lastReactionTsRef.current = Math.max(...d.reactions.map((r: any) => r.ts))
          }
        }
        // Kicked check
        if (Array.isArray(d.kickedGuests) && d.kickedGuests.includes(guestId)) {
          setKicked(true)
        }
      }
    } catch {}
  }, [partyId, guestId, username])

  useEffect(() => {
    if (!partyId) return
    poll()
    pollRef.current = setInterval(poll, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [partyId, poll])

  // Redirect if kicked
  useEffect(() => {
    if (kicked) {
      const t = setTimeout(() => router.push("/"), 2000)
      return () => clearTimeout(t)
    }
  }, [kicked, router])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat])

  // ── Search ───────────────────────────────────────────────────
  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!query.trim()) return
    setSearching(true)
    try {
      const res  = await fetch(`/api/musiva/search?q=${encodeURIComponent(query)}&filter=songs&limit=20`)
      const data = await res.json()
      const songs = (data.results || []).map((t: any): Song => ({
        id:        t.videoId || t.id,
        title:     t.title,
        artist:    Array.isArray(t.artists) ? t.artists.map((a: any) => a.name).join(", ") : (t.artist || "Unknown"),
        thumbnail: t.thumbnail || t.thumbnails?.[0]?.url || "",
        type:      "musiva",
        videoId:   t.videoId || t.id,
        duration:  t.duration || "",
      }))
      setResults(songs)
    } catch {}
    setSearching(false)
  }

  // ── Add song ─────────────────────────────────────────────────
  const addSong = async (song: Song) => {
    try {
      // Add to external server (primary queue) if available
      if (PARTY_SERVER) {
        const res = await fetch(`${PARTY_SERVER}/party/${partyId}/queue`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ song, guestName: username }),
        })
        if (res.status === 409) {
          setDupIds(prev => new Set(prev).add(song.id))
          setTimeout(() => setDupIds(prev => { const n = new Set(prev); n.delete(song.id); return n }), 2500)
          return
        }
        if (!res.ok) return
      }
      // Also add to local API for guestName tracking + removeSong support
      await fetch("/api/party", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "addSong", partyId, guestId, username, song }),
      })
      setAddedIds(prev => new Set(prev).add(song.id))
      setTimeout(() => setAddedIds(prev => { const n = new Set(prev); n.delete(song.id); return n }), 2500)
      await poll()
    } catch {}
  }

  // ── Vote ─────────────────────────────────────────────────────
  const voteSong = async (songId: string) => {
    await fetch("/api/party", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "vote", partyId, guestId, songId }),
    })
    await poll()
  }

  // ── Remove song (host only) ──────────────────────────────────
  const removeSong = async (songId: string) => {
    await fetch("/api/party", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "removeSong", partyId, guestId, songId }),
    })
    await poll()
  }

  // ── Chat ─────────────────────────────────────────────────────
  const sendChat = async () => {
    const text = chatInput.trim()
    if (!text) return
    setChatInput("")
    const body: any = { action: "chat", partyId, guestId, username, text }
    if (replyTo) body.replyTo = replyTo
    setReplyTo(null)
    await fetch("/api/party", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    })
    await poll()
  }

  const deleteMessage = async (messageId: string) => {
    await fetch("/api/party", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "deleteChat", partyId, guestId, username, messageId }),
    })
    await poll()
  }

  // ── Reactions ────────────────────────────────────────────────
  const sendReaction = async (emoji: string) => {
    const newR = { emoji, id: Date.now() }
    setReactions(prev => [...prev, newR])
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== newR.id)), 2500)
    await fetch("/api/party", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "react", partyId, guestId, username, emoji }),
    })
    // Broadcast to peers via WebRTC too
    if (rtcRef.current?.isConnected) {
      rtcRef.current.broadcast({ type: "reaction", payload: { emoji, user: username } })
    }
  }

  // ── Kick guest (host only) ───────────────────────────────────
  const kickGuest = async (kickGuestId: string) => {
    await fetch("/api/party", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "kick", partyId, guestId, kickGuestId }),
    })
    await poll()
  }

  // ── Kicked screen ────────────────────────────────────────────
  if (kicked) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background flex items-center justify-center">
        <div className="text-center space-y-4 p-8">
          <UserX className="w-16 h-16 mx-auto text-destructive" />
          <h2 className="text-2xl font-bold">You've been removed</h2>
          <p className="text-muted-foreground">The host has removed you from this party.</p>
          <p className="text-xs text-muted-foreground">Redirecting…</p>
        </div>
      </div>
    )
  }

  // ── Tabs available ───────────────────────────────────────────
  const tabs = (["search", "queue", "chat", ...(isHost ? ["members"] : [])] as const)

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background">
      {/* Floating reactions */}
      <div className="fixed bottom-32 right-4 z-50 flex flex-col gap-1 pointer-events-none">
        {reactions.map(r => (
          <div
            key={r.id}
            className={[
              "text-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 text-center",
              r.fromOther ? "opacity-80" : "",
            ].join(" ")}
          >
            {r.emoji}
          </div>
        ))}
      </div>

      <div className="container mx-auto px-4 py-6 max-w-2xl">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                Party Mode
                {isHost && <span className="text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5">Host</span>}
              </h1>
              <p className="text-xs text-muted-foreground font-mono">
                ID: {partyId} · {username} · {guests.length} guest{guests.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.back()} className="rounded-full gap-2">
            <Music className="w-4 h-4" /> App
          </Button>
        </header>

        {/* ── Now Playing card ── */}
        {currentSong && (
          <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-2xl p-4 mb-5 shadow flex items-center gap-4">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
              <img src={currentSong.thumbnail} alt={currentSong.title} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider mb-0.5">Now Playing</p>
              <p className="font-bold text-sm truncate">{currentSong.title}</p>
              <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
            </div>
            <Equalizer playing={isPlaying} />
          </div>
        )}

        {/* Emoji reactions bar */}
        <div className="flex gap-2 justify-center mb-5 flex-wrap">
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => sendReaction(e)}
              className="text-xl p-2 rounded-full bg-card/50 hover:bg-card/80 hover:scale-110 transition-all active:scale-95"
            >
              {e}
            </button>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-card/40 rounded-2xl p-1 mb-5 border border-border/30 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={[
                "flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-all whitespace-nowrap px-2",
                activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {tab === "chat"    && `💬 Chat${chat.length  ? ` (${chat.length})`  : ""}`}
              {tab === "queue"   && `🎵 Queue${sortedQueue.length ? ` (${sortedQueue.length})` : ""}`}
              {tab === "search"  && "🔍 Search"}
              {tab === "members" && `👥 Members${guests.length ? ` (${guests.length})` : ""}`}
            </button>
          ))}
        </div>

        {/* ── Search Tab ── */}
        {activeTab === "search" && (
          <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-5 shadow-xl">
            <form onSubmit={handleSearch} className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search for songs..."
                className="pl-11 h-11 rounded-2xl bg-background/50 border-border/50"
              />
              {searching && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}
            </form>
            <div className="space-y-2 max-h-[55vh] overflow-y-auto">
              {results.map(song => (
                <div key={song.id} className="flex items-center gap-3 p-2 rounded-2xl hover:bg-primary/5 transition-colors">
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                    <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>
                  <Button
                    size="icon"
                    variant={addedIds.has(song.id) ? "default" : dupIds.has(song.id) ? "destructive" : "secondary"}
                    className="rounded-full flex-shrink-0 w-8 h-8"
                    onClick={() => addSong(song)}
                    disabled={addedIds.has(song.id) || dupIds.has(song.id)}
                  >
                    {addedIds.has(song.id) ? <Check className="w-3.5 h-3.5" /> : dupIds.has(song.id) ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              ))}
              {results.length === 0 && !searching && (
                <div className="text-center py-10 text-muted-foreground opacity-50">
                  <Music className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">Search for your favorite tracks</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Queue Tab ── */}
        {activeTab === "queue" && (
          <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-5 shadow-xl">
            <h2 className="font-semibold mb-4 text-sm text-muted-foreground flex items-center gap-2">
              <ListMusic className="w-4 h-4" />
              Party Queue — sorted by votes
            </h2>
            {sortedQueue.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground opacity-50">
                <Music className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">No songs yet — search and add some!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {sortedQueue.map((song: any, i) => (
                  <div key={song.id + i} className="flex items-center gap-3 p-2 rounded-2xl bg-card/40">
                    <span className="text-xs text-muted-foreground w-5 text-center font-mono">{i + 1}</span>
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                      <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {song.artist}
                        {song.guestName && (
                          <span className="ml-1 text-primary/70">· by {song.guestName}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => voteSong(song.id)}
                        className={[
                          "flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all",
                          hasVoted(song.id)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-primary/20 hover:text-primary",
                        ].join(" ")}
                      >
                        <ThumbsUp className="w-3 h-3" />
                        {getVoteCount(song.id)}
                      </button>
                      {isHost && (
                        <button
                          onClick={() => removeSong(song.id)}
                          className="p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                          title="Remove from queue"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Chat Tab ── */}
        {activeTab === "chat" && (
          <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-5 shadow-xl">
            <div className="h-[50vh] overflow-y-auto space-y-2 mb-4 pr-1">
              {chat.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground opacity-50">
                  <MessageCircle className="w-10 h-10 mx-auto mb-2" />
                  <p className="text-sm">No messages yet</p>
                </div>
              ) : (
                chat.map(msg => {
                  const isOwn     = msg.user === username
                  const canDelete = isOwn || isHost
                  return (
                    <div key={msg.id} className={`flex gap-2 group ${isOwn ? "flex-row-reverse" : ""}`}>
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                        <span className="text-[10px] font-bold text-primary">{msg.user[0]?.toUpperCase()}</span>
                      </div>
                      <div className="max-w-[75%] space-y-0.5">
                        <div className={[
                          "rounded-2xl px-3 py-2",
                          isOwn ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card/80 rounded-tl-sm",
                        ].join(" ")}>
                          {!isOwn && (
                            <p className="text-[10px] font-semibold text-primary mb-0.5">{msg.user}</p>
                          )}
                          {msg.replyTo && <ReplyBlock reply={msg.replyTo} own={isOwn} />}
                          <p className="text-sm">{msg.text}</p>
                        </div>
                        {/* Action row */}
                        <div className={`flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ${isOwn ? "justify-end" : "justify-start"}`}>
                          <button
                            onClick={() => setReplyTo({ id: msg.id, user: msg.user, text: msg.text })}
                            className="text-[10px] flex items-center gap-0.5 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Reply className="w-3 h-3" /> Reply
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => deleteMessage(msg.id)}
                              className="text-[10px] flex items-center gap-0.5 text-muted-foreground hover:text-destructive transition-colors"
                            >
                              <Trash2 className="w-3 h-3" /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={chatEndRef} />
            </div>
            {/* Reply indicator */}
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-primary/10 rounded-xl border border-primary/20">
                <Reply className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-primary">{replyTo.user}</p>
                  <p className="text-xs truncate text-muted-foreground">{replyTo.text}</p>
                </div>
                <button onClick={() => setReplyTo(null)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendChat()}
                placeholder={replyTo ? `Replying to ${replyTo.user}…` : "Type a message…"}
                className="rounded-xl bg-background/50"
              />
              <Button onClick={sendChat} size="icon" className="rounded-xl flex-shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Members Tab (host only) ── */}
        {activeTab === "members" && isHost && (
          <div className="bg-card/50 backdrop-blur-xl border border-border/50 rounded-3xl p-5 shadow-xl">
            <h2 className="font-semibold mb-4 text-sm text-muted-foreground flex items-center gap-2">
              <Users className="w-4 h-4" />
              Connected Guests ({guests.length})
            </h2>
            {guests.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground opacity-50">
                <Users className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">No guests have joined yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {guests.map(g => (
                  <div key={g.id} className="flex items-center gap-3 p-3 rounded-2xl bg-card/40">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-primary">{g.name[0]?.toUpperCase()}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {g.name}
                        {g.id === guestId && (
                          <span className="ml-1 text-xs bg-primary/20 text-primary rounded-full px-1.5 py-0.5">You (Host)</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Joined {new Date(g.joinedAt).toLocaleTimeString()}
                      </p>
                    </div>
                    {g.id !== guestId && (
                      <Button
                        size="sm"
                        variant="destructive"
                        className="rounded-full text-xs h-7 px-3"
                        onClick={() => kickGuest(g.id)}
                      >
                        <UserX className="w-3 h-3 mr-1" /> Kick
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
