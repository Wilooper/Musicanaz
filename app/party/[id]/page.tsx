"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Search, Music, Plus, Loader2, Users, Check, ChevronLeft, MessageCircle, Send, ThumbsUp, Smile } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getGuestId, getPartyUsername } from "@/lib/storage"
import type { Song } from "@/lib/types"

const EMOJIS = ["🔥", "❤️", "😍", "🎵", "💃", "🙌", "🎉", "😮"]

interface ChatMsg { id: string; user: string; text: string; ts: number }
interface VoteData { songId: string; voters: string[] }

export default function PartyGuestPage() {
  const { id }   = useParams()
  const router   = useRouter()
  const partyId  = typeof id === "string" ? id : ""
  const guestId  = getGuestId()
  const username = getPartyUsername()

  const [query,     setQuery]     = useState("")
  const [results,   setResults]   = useState<Song[]>([])
  const [searching, setSearching] = useState(false)
  const [addedIds,  setAddedIds]  = useState<Set<string>>(new Set())
  const [chat,      setChat]      = useState<ChatMsg[]>([])
  const [chatInput, setChatInput] = useState("")
  const [votes,     setVotes]     = useState<VoteData[]>([])
  const [queue,     setQueue]     = useState<Song[]>([])
  const [activeTab, setActiveTab] = useState<"search" | "queue" | "chat">("search")
  const [reactions, setReactions] = useState<{ emoji: string; id: number }[]>([])
  const chatEndRef = useRef<HTMLDivElement>(null)
  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  // Poll party state every 3 seconds
  const poll = useCallback(async () => {
    try {
      const res  = await fetch(`/api/party?id=${partyId}`)
      if (!res.ok) return
      const data = await res.json()
      setChat(data.chat  || [])
      setVotes(data.votes || [])
      setQueue(data.queue || [])
    } catch {}
  }, [partyId])

  useEffect(() => {
    if (!partyId) return
    poll()
    pollRef.current = setInterval(poll, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [partyId, poll])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chat])

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

  const addSong = async (song: Song) => {
    try {
      const res = await fetch("/api/party", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "addSong", partyId, guestId, song }),
      })
      if (res.ok) {
        setAddedIds(prev => new Set(prev).add(song.id))
        setTimeout(() => setAddedIds(prev => { const n = new Set(prev); n.delete(song.id); return n }), 2500)
        poll()
      }
    } catch {}
  }

  const voteSong = async (songId: string) => {
    await fetch("/api/party", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "vote", partyId, guestId, songId }),
    })
    poll()
  }

  const sendChat = async () => {
    const text = chatInput.trim()
    if (!text) return
    setChatInput("")
    await fetch("/api/party", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "chat", partyId, guestId, username, text }),
    })
    poll()
  }

  const sendReaction = async (emoji: string) => {
    const newR = { emoji, id: Date.now() }
    setReactions(prev => [...prev, newR])
    setTimeout(() => setReactions(prev => prev.filter(r => r.id !== newR.id)), 2000)
    await fetch("/api/party", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ action: "react", partyId, guestId, emoji }),
    })
  }

  const getVoteCount = (songId: string) => votes.find(v => v.songId === songId)?.voters.length || 0
  const hasVoted     = (songId: string) => votes.find(v => v.songId === songId)?.voters.includes(guestId) || false

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 via-background to-background">
      {/* Floating reactions */}
      <div className="fixed bottom-32 right-4 z-50 flex flex-col gap-1 pointer-events-none">
        {reactions.map(r => (
          <div key={r.id} className="text-2xl animate-in slide-in-from-bottom-4 fade-in duration-300 text-center">
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
              <h1 className="text-xl font-bold">Party Mode</h1>
              <p className="text-xs text-muted-foreground font-mono">ID: {partyId} · {username}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push("/")} className="rounded-full gap-2">
            <Music className="w-4 h-4" /> App
          </Button>
        </header>

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
        <div className="flex gap-1 bg-card/40 rounded-2xl p-1 mb-5 border border-border/30">
          {(["search", "queue", "chat"] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "flex-1 py-2 rounded-xl text-sm font-medium capitalize transition-all",
                activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {tab === "chat"   && `💬 Chat${chat.length  ? ` (${chat.length})`  : ""}`}
              {tab === "queue"  && `🎵 Queue${queue.length ? ` (${queue.length})` : ""}`}
              {tab === "search" && "🔍 Search"}
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
                    variant={addedIds.has(song.id) ? "default" : "secondary"}
                    className="rounded-full flex-shrink-0 w-8 h-8"
                    onClick={() => addSong(song)}
                    disabled={addedIds.has(song.id)}
                  >
                    {addedIds.has(song.id) ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
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
            <h2 className="font-semibold mb-4 text-sm text-muted-foreground">Party Queue — vote to move songs up!</h2>
            {queue.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground opacity-50">
                <Music className="w-10 h-10 mx-auto mb-2" />
                <p className="text-sm">No songs yet — search and add some!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {queue.map((song: Song, i) => (
                  <div key={song.id + i} className="flex items-center gap-3 p-2 rounded-2xl bg-card/40">
                    <span className="text-xs text-muted-foreground w-4 text-center font-mono">{i + 1}</span>
                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                      <img src={song.thumbnail} alt={song.title} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{song.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                    </div>
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
                chat.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.user === username ? "flex-row-reverse" : ""}`}>
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-1">
                      <span className="text-[10px] font-bold text-primary">{msg.user[0]?.toUpperCase()}</span>
                    </div>
                    <div className={[
                      "max-w-[75%] rounded-2xl px-3 py-2",
                      msg.user === username ? "bg-primary text-primary-foreground rounded-tr-sm" : "bg-card/80 rounded-tl-sm",
                    ].join(" ")}>
                      {msg.user !== username && (
                        <p className="text-[10px] font-semibold text-primary mb-0.5">{msg.user}</p>
                      )}
                      <p className="text-sm">{msg.text}</p>
                    </div>
                  </div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <Input
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendChat()}
                placeholder="Type a message..."
                className="rounded-xl bg-background/50"
              />
              <Button onClick={sendChat} size="icon" className="rounded-xl flex-shrink-0">
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
