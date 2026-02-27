"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useParams } from "next/navigation"
import {
  ChevronLeft, Users, Music, Play, Plus, Check,
  Trash2, Search, Loader2, Link2,
  RefreshCw, ListMusic, Bell, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import ImageWithFallback from "@/components/image-with-fallback"
import { useAudio } from "@/lib/audio-context"
import { getGuestId, getPartyUsername, saveCollabRef, removeCollabRef } from "@/lib/storage"
import type { Song } from "@/lib/types"

interface CollabSong extends Song { addedBy: string; addedAt: number }
interface CollabEvent { type: string; songTitle?: string; by: string; at: number }
interface Playlist {
  id: string; name: string; ownerId: string
  songs: CollabSong[]; updatedAt: number; events: CollabEvent[]
}
interface Toast { id: number; message: string; emoji: string }

function getBestThumbnail(thumbnails: any): string {
  if (!thumbnails) return ""
  if (typeof thumbnails === "string") return thumbnails
  if (!Array.isArray(thumbnails) || !thumbnails.length) return ""
  const sorted = [...thumbnails].sort((a: any, b: any) => (b?.width || 0) - (a?.width || 0))
  const best = sorted[0]
  return typeof best === "string" ? best : best?.url || ""
}

function timeAgo(ms: number) {
  const d = Date.now() - ms
  if (d < 60_000)   return "just now"
  if (d < 3600_000) return Math.floor(d / 60_000) + "m ago"
  if (d < 86400_000) return Math.floor(d / 3600_000) + "h ago"
  return Math.floor(d / 86400_000) + "d ago"
}

export default function CollabPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = params?.id as string
  const { playPlaylist, playSong } = useAudio()

  const userId   = typeof window !== "undefined" ? getGuestId()       : "anon"
  const username = typeof window !== "undefined" ? getPartyUsername() : "Guest"

  const [playlist,   setPlaylist]   = useState<Playlist | null>(null)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState("")
  const [tab,        setTab]        = useState<"songs" | "search">("songs")
  const [query,      setQuery]      = useState("")
  const [results,    setResults]    = useState<Song[]>([])
  const [searching,  setSearching]  = useState(false)
  const [adding,     setAdding]     = useState<string | null>(null)
  const [added,      setAdded]      = useState<Set<string>>(new Set())
  const [copied,     setCopied]     = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [deleting,   setDeleting]   = useState(false)
  const [toasts,     setToasts]     = useState<Toast[]>([])
  const [showEvents, setShowEvents] = useState(false)

  const lastEventAt   = useRef<number>(0)
  const toastIdRef    = useRef(0)
  const pollRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const hasMountedRef = useRef(false)

  const pushToast = (message: string, emoji = "🎵") => {
    const tid = ++toastIdRef.current
    setToasts(prev => [...prev, { id: tid, message, emoji }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== tid)), 4500)
  }

  const fetchPlaylist = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const since = lastEventAt.current
      const res   = await fetch(`/api/collab?id=${id}&since=${since}`)
      if (!res.ok) { setError("Playlist not found or expired."); return }
      const data: Playlist = await res.json()

      if (hasMountedRef.current && data.events && data.events.length > 0) {
        for (const ev of data.events) {
          if (ev.at > lastEventAt.current) {
            const isMe = ev.by === username || ev.by === userId
            if (!isMe) {
              if (ev.type === "addSong")    pushToast(`${ev.by} added "${ev.songTitle}"`, "🎵")
              if (ev.type === "removeSong") pushToast(`${ev.by} removed "${ev.songTitle}"`, "🗑️")
            }
          }
        }
        const latest = Math.max(...data.events.map(e => e.at))
        if (latest > lastEventAt.current) lastEventAt.current = latest
      }

      setPlaylist(data)
      setError("")
      saveCollabRef({ id: data.id, name: data.name, joined: Date.now(), isOwner: data.ownerId === userId })

      if (!hasMountedRef.current) {
        hasMountedRef.current = true
        if (data.events && data.events.length > 0) {
          lastEventAt.current = Math.max(...data.events.map((e: CollabEvent) => e.at))
        }
      }
    } catch { setError("Could not load playlist.") }
    finally { setLoading(false); setRefreshing(false) }
  }, [id, userId, username])

  useEffect(() => {
    fetchPlaylist()
    pollRef.current = setInterval(() => fetchPlaylist(true), 4000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [fetchPlaylist])

  const searchSongs = async () => {
    if (!query.trim()) return
    setSearching(true)
    setResults([])
    try {
      const res  = await fetch(`/api/musiva/search?q=${encodeURIComponent(query.trim())}&filter=songs&limit=15`)
      const data = await res.json()
      const raw: any[] = data.results || []
      const songs: Song[] = raw.map((t: any) => ({
        id:        t.videoId || t.id || "",
        title:     t.title   || "Unknown",
        artist:    Array.isArray(t.artists)
          ? t.artists.map((a: any) => typeof a === "string" ? a : a?.name || "").filter(Boolean).join(", ")
          : String(t.artist || t.artists || "Unknown"),
        thumbnail: t.thumbnail || getBestThumbnail(t.thumbnails),
        type:      "musiva" as const,
        videoId:   t.videoId || t.id || "",
        duration:  t.duration || "",
        album:     typeof t.album === "string" ? t.album : t.album?.name || "",
      })).filter(s => s.id)
      setResults(songs)
    } catch (e) {
      console.error("Collab search error:", e)
    } finally {
      setSearching(false)
    }
  }

  const addSong = async (song: Song) => {
    setAdding(song.id)
    try {
      const res = await fetch("/api/collab", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "addSong", id, song, userId, username }),
      })
      const data = await res.json()
      if (data.ok) {
        setPlaylist(data.playlist)
        setAdded(prev => new Set([...prev, song.id]))
        if (data.playlist?.events?.length > 0) {
          lastEventAt.current = Math.max(...data.playlist.events.map((e: CollabEvent) => e.at))
        }
      } else {
        pushToast(data.error || "Could not add song", "⚠️")
      }
    } catch {}
    finally { setAdding(null) }
  }

  const removeSong = async (songId: string, songTitle: string) => {
    if (!confirm(`Remove "${songTitle}" from the playlist?`)) return
    try {
      const res = await fetch("/api/collab", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "removeSong", id, songId, userId, username }),
      })
      const data = await res.json()
      if (data.ok) {
        setPlaylist(data.playlist)
        if (data.playlist?.events?.length > 0) {
          lastEventAt.current = Math.max(...data.playlist.events.map((e: CollabEvent) => e.at))
        }
      }
    } catch {}
  }

  const deletePlaylist = async () => {
    if (!confirm(`Delete "${playlist?.name}"? This cannot be undone.`)) return
    setDeleting(true)
    try {
      const res = await fetch("/api/collab", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ action: "deletePlaylist", id, userId }),
      })
      const data = await res.json()
      if (data.ok) {
        removeCollabRef(id)
        router.replace("/library")
      } else {
        pushToast(data.error || "Could not delete", "⚠️")
        setDeleting(false)
      }
    } catch { setDeleting(false) }
  }

  const shareLink = () => {
    const url = `${window.location.origin}/collab/${id}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const isOwner = playlist?.ownerId === userId

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
    </div>
  )

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-8 text-center">
      <Users className="w-12 h-12 text-muted-foreground/30" />
      <p className="font-semibold">{error}</p>
      <p className="text-sm text-muted-foreground">The playlist may have expired (7 days) or the link is wrong.</p>
      <Button onClick={() => router.push("/library")} className="rounded-full px-8">Go to Library</Button>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">

      {/* In-app notification toasts */}
      <div className="fixed top-4 left-0 right-0 z-50 flex flex-col items-center gap-2 pointer-events-none px-4">
        {toasts.map(t => (
          <div
            key={t.id}
            className="flex items-center gap-2.5 bg-card/95 backdrop-blur-xl border border-border/40 rounded-2xl px-4 py-3 shadow-2xl max-w-sm w-full pointer-events-auto animate-in slide-in-from-top-2"
          >
            <span className="text-lg flex-shrink-0">{t.emoji}</span>
            <p className="text-sm font-medium flex-1 min-w-0 truncate">{t.message}</p>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              className="text-muted-foreground/60 hover:text-foreground flex-shrink-0 p-1"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/30">
        <div className="flex items-center gap-2 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full flex-shrink-0 w-9 h-9">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Users className="w-4 h-4 text-primary flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm truncate leading-tight">{playlist?.name}</p>
            <p className="text-[11px] text-muted-foreground">{playlist?.songs.length} songs · live updates</p>
          </div>

          {/* Activity log bell */}
          <button
            onClick={() => setShowEvents(v => !v)}
            title="Activity log"
            className={`p-2 rounded-full transition-colors relative ${showEvents ? "bg-primary/15 text-primary" : "hover:bg-card/60 text-muted-foreground"}`}
          >
            <Bell className="w-4 h-4" />
          </button>

          {/* Refresh */}
          <button onClick={() => fetchPlaylist(true)} className="p-2 rounded-full hover:bg-card/60 transition-colors">
            <RefreshCw className={`w-4 h-4 text-muted-foreground ${refreshing ? "animate-spin" : ""}`} />
          </button>

          {/* Share link */}
          <button
            onClick={shareLink}
            className="flex items-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-full text-xs font-semibold transition-colors flex-shrink-0"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Share"}
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 border-t border-border/20">
          {([
            { id: "songs",  label: "Playlist",  icon: <ListMusic className="w-3.5 h-3.5" /> },
            { id: "search", label: "Add Songs",  icon: <Plus      className="w-3.5 h-3.5" /> },
          ] as const).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all",
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-4 pb-36 space-y-3">

        {/* Activity log */}
        {showEvents && (
          <div className="rounded-2xl bg-card/40 border border-border/30 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Activity Log</p>
              <button onClick={() => setShowEvents(false)} className="text-muted-foreground/50 hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            {!playlist?.events?.length ? (
              <p className="text-xs text-muted-foreground/50 text-center py-6">No activity yet</p>
            ) : (
              <div className="divide-y divide-border/15 max-h-56 overflow-y-auto">
                {playlist.events.map((ev, i) => (
                  <div key={i} className="flex items-center gap-2.5 px-4 py-2.5">
                    <span className="text-base flex-shrink-0">
                      {ev.type === "addSong" ? "🎵" : ev.type === "removeSong" ? "🗑️" : ev.type === "rename" ? "✏️" : "✅"}
                    </span>
                    <p className="flex-1 text-xs min-w-0 truncate">
                      {ev.type === "addSong"    && <><strong>{ev.by}</strong> added &ldquo;{ev.songTitle}&rdquo;</>}
                      {ev.type === "removeSong" && <><strong>{ev.by}</strong> removed &ldquo;{ev.songTitle}&rdquo;</>}
                      {ev.type === "rename"     && <><strong>{ev.by}</strong> renamed the playlist</>}
                      {ev.type === "create"     && <><strong>{ev.by}</strong> created this playlist</>}
                    </p>
                    <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{timeAgo(ev.at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── PLAYLIST TAB ── */}
        {tab === "songs" && (
          <>
            {playlist && (playlist.songs.length > 0 || isOwner) && (
              <div className="flex gap-2">
                {playlist.songs.length > 0 && (
                  <Button
                    onClick={() => playPlaylist(playlist.songs.map(s => ({ ...s, type: "musiva" as const })), 0)}
                    className="flex-1 gap-2 rounded-2xl h-10 text-sm"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Play All
                  </Button>
                )}
                {isOwner && (
                  <Button
                    onClick={deletePlaylist}
                    variant="destructive"
                    disabled={deleting}
                    className={`rounded-2xl h-10 px-4 gap-1.5 text-sm ${playlist.songs.length === 0 ? "flex-1" : ""}`}
                  >
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    Delete Playlist
                  </Button>
                )}
              </div>
            )}

            {playlist?.songs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                  <Music className="w-6 h-6 text-primary/40" />
                </div>
                <p className="font-semibold mb-1">No songs yet</p>
                <p className="text-sm text-muted-foreground mb-4">You and your friends can add songs</p>
                <Button onClick={() => setTab("search")} className="rounded-full px-6 h-9 text-sm gap-1.5">
                  <Plus className="w-3.5 h-3.5" />Add First Song
                </Button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {playlist?.songs.map((song, i) => {
                  const canRemove = isOwner || song.addedBy === username || song.addedBy === userId
                  return (
                    <div
                      key={`${song.id}-${i}`}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-card/50 transition-colors group"
                    >
                      <span className="text-xs text-muted-foreground/40 w-5 text-center flex-shrink-0 tabular-nums">{i + 1}</span>
                      <div
                        className="relative w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0 cursor-pointer"
                        onClick={() => playSong(song)}
                      >
                        <ImageWithFallback
                          src={song.thumbnail} alt={song.title}
                          className="w-full h-full object-cover"
                          fallback={<div className="w-full h-full flex items-center justify-center bg-muted"><Music className="w-4 h-4 text-muted-foreground" /></div>}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                          <Play className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 fill-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => playSong(song)}>
                        <p className="font-semibold text-sm truncate leading-snug">{song.title}</p>
                        <p className="text-xs text-muted-foreground/70 truncate">
                          {song.artist}
                          <span className="mx-1 opacity-40">·</span>
                          <span className="opacity-60">
                            {(song.addedBy === username || song.addedBy === userId) ? "you" : song.addedBy}
                            {" · "}{timeAgo(song.addedAt)}
                          </span>
                        </p>
                      </div>
                      {/* Remove button — always visible, not hidden */}
                      {canRemove && (
                        <button
                          onClick={() => removeSong(song.id, song.title)}
                          className="flex-shrink-0 p-1.5 rounded-full text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-all"
                          title="Remove song"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ── SEARCH TAB ── */}
        {tab === "search" && (
          <>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && searchSongs()}
                  placeholder="Search songs to add…"
                  className="pl-10 h-11 rounded-2xl bg-card/50"
                  autoFocus
                />
              </div>
              <Button onClick={searchSongs} disabled={searching || !query.trim()} className="rounded-2xl px-5 h-11">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>

            {searching && (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Searching…</p>
              </div>
            )}

            {!searching && results.length > 0 && (
              <div className="space-y-0.5">
                {results.map(song => {
                  const isAdded  = added.has(song.id) || !!playlist?.songs.some(s => s.id === song.id)
                  const isAdding = adding === song.id
                  return (
                    <div key={song.id} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-card/60 transition-colors">
                      <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                        <ImageWithFallback
                          src={song.thumbnail} alt={song.title}
                          className="w-full h-full object-cover"
                          fallback={<div className="w-full h-full flex items-center justify-center bg-muted"><Music className="w-4 h-4 text-muted-foreground" /></div>}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{song.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                      </div>
                      <button
                        onClick={() => !isAdded && !isAdding && addSong(song)}
                        disabled={isAdded || isAdding}
                        className={[
                          "flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all",
                          isAdded
                            ? "bg-green-500/15 text-green-500 cursor-default"
                            : "bg-primary/10 text-primary hover:bg-primary/25 active:scale-95",
                        ].join(" ")}
                        title={isAdded ? "Already added" : "Add to playlist"}
                      >
                        {isAdding ? <Loader2 className="w-4 h-4 animate-spin" />
                          : isAdded ? <Check className="w-4 h-4" />
                          : <Plus className="w-4 h-4" />}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}

            {!searching && results.length === 0 && query.trim() && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Music className="w-10 h-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm font-medium">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-xs text-muted-foreground mt-1">Try different keywords</p>
              </div>
            )}

            {!query.trim() && !searching && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Search className="w-10 h-10 text-muted-foreground/20 mb-3" />
                <p className="text-sm text-muted-foreground">Type a song name and press Enter</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
