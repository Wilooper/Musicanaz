"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ChevronLeft, Clock, Loader2, Play, Music, Shuffle } from "lucide-react"
import { Button } from "@/components/ui/button"
import ImageWithFallback from "@/components/image-with-fallback"
import { useAudio } from "@/lib/audio-context"
import { addToRecentlyPlayed } from "@/lib/storage"

function getBestThumbnail(thumbnails: any[]): string {
  if (!thumbnails?.length) return ""
  const sorted = [...thumbnails].sort((a, b) => (b?.width || 0) - (a?.width || 0))
  const t = sorted[0]
  return typeof t === "string" ? t : t?.url || t?.thumbnail || ""
}

function toSong(track: any, fallbackThumb = "") {
  const thumb = track.thumbnail || getBestThumbnail(track.thumbnails || []) || fallbackThumb
  const artist = Array.isArray(track.artists)
    ? track.artists.map((a: any) => (typeof a === "string" ? a : a?.name || "")).join(", ")
    : String(track.artists || track.artist || "Unknown")
  return {
    id: track.videoId || "",
    title: track.title || "Unknown",
    artist,
    thumbnail: thumb,
    type: "musiva" as const,
    videoId: track.videoId || "",
    duration: track.duration || "",
  }
}

function PlaylistContent() {
  const router    = useRouter()
  const params    = useSearchParams()
  const id        = params.get("id")
  const { playSong, playPlaylist } = useAudio()

  const [playlist, setPlaylist] = useState<any>(null)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    // Try the dedicated playlist endpoint first, with proper VL-prefix handling
    const fetchPlaylist = async () => {
      // ytmusicapi expects IDs WITHOUT "VL" prefix
      const cleanId = id.startsWith("VL") ? id.slice(2) : id
      const urls = [
        `/api/musiva/playlist?id=${encodeURIComponent(cleanId)}&limit=100`,
        `/api/musiva/playlist?id=${encodeURIComponent(id)}&limit=100`,
        `/api/musiva/play/${encodeURIComponent(cleanId)}`,
        `/api/musiva/play/${encodeURIComponent(id)}`,
      ]
      for (const url of urls) {
        try {
          const res = await fetch(url)
          if (!res.ok) continue
          const data = await res.json()
          if (data.tracks?.length || data.title) {
            setPlaylist(data)
            setLoading(false)
            return
          }
        } catch {}
      }
      setLoading(false)
    }
    fetchPlaylist()
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  )
  if (!playlist) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <p>Playlist not found</p>
      <Button onClick={() => router.back()}>Go back</Button>
    </div>
  )

  const thumb   = getBestThumbnail(playlist.thumbnails || [])
  const tracks: any[] = playlist.tracks || []
  const author  = playlist.author?.name || playlist.author || ""

  const playTrack = (track: any) => {
    if (!track.videoId) return
    const song = toSong(track, thumb)
    playSong(song, true)
    addToRecentlyPlayed(song)
    router.push(`/player?id=${encodeURIComponent(song.id)}&title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}&thumbnail=${encodeURIComponent(song.thumbnail)}&type=musiva&videoId=${encodeURIComponent(song.videoId || "")}`)
  }

  const playAll = (shuffle = false) => {
    const playable = tracks.filter(t => t.videoId).map(t => toSong(t, thumb))
    if (!playable.length) return
    const list = shuffle ? [...playable].sort(() => Math.random() - 0.5) : playable
    playPlaylist(list, 0)
    addToRecentlyPlayed(list[0])
    router.push(
      `/player?id=${encodeURIComponent(list[0].id)}&title=${encodeURIComponent(list[0].title)}&artist=${encodeURIComponent(list[0].artist)}&thumbnail=${encodeURIComponent(list[0].thumbnail)}&type=musiva&videoId=${encodeURIComponent(list[0].videoId || list[0].id)}`
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-semibold truncate">{playlist.title}</span>
      </div>

      <div className="container mx-auto px-4 pb-36">
        {/* Header */}
        <div className="flex flex-col sm:flex-row gap-6 py-8 items-start">
          <div className="w-44 h-44 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl bg-muted mx-auto sm:mx-0">
            {thumb
              ? <img src={thumb} alt={playlist.title} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center"><Music className="w-10 h-10 text-muted-foreground" /></div>
            }
          </div>
          <div className="flex flex-col justify-end text-center sm:text-left">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Playlist</p>
            <h1 className="text-3xl font-bold mb-2">{playlist.title}</h1>
            {author && <p className="text-muted-foreground text-sm mb-1">{author}</p>}
            {playlist.description && <p className="text-sm text-muted-foreground line-clamp-2 max-w-lg mt-1">{playlist.description}</p>}
            <p className="text-sm text-muted-foreground mt-2">{tracks.length} tracks</p>
            <div className="flex gap-3 mt-4 justify-center sm:justify-start">
              <Button onClick={() => playAll(false)} className="rounded-full px-6 gap-2">
                <Play className="w-4 h-4" fill="currentColor" /> Play All
              </Button>
              <Button variant="outline" onClick={() => playAll(true)} className="rounded-full px-6 gap-2">
                <Shuffle className="w-4 h-4" /> Shuffle
              </Button>
            </div>
          </div>
        </div>

        {/* Track list */}
        {tracks.length > 0 && (
          <div>
            <div className="grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/30 mb-1">
              <span className="w-8 text-center">#</span>
              <span>Title</span>
              <span><Clock className="w-3.5 h-3.5" /></span>
            </div>
            {tracks.map((track: any, idx: number) => (
              <div
                key={idx}
                onClick={() => playTrack(track)}
                className={`grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-3 rounded-xl items-center group hover:bg-card/50 transition-colors ${!track.videoId ? "opacity-40 pointer-events-none" : "cursor-pointer"}`}
              >
                <div className="w-8 text-center flex-shrink-0">
                  <span className="text-sm text-muted-foreground group-hover:hidden">{idx + 1}</span>
                  <Play className="w-4 h-4 text-primary hidden group-hover:inline" fill="currentColor" />
                </div>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <ImageWithFallback
                      src={track.thumbnail || getBestThumbnail(track.thumbnails || [])}
                      alt={track.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{track.title}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {Array.isArray(track.artists)
                        ? track.artists.map((a: any) => (typeof a === "string" ? a : a?.name || "")).join(", ")
                        : track.artists || ""}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{track.duration || ""}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function PlaylistPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <PlaylistContent />
    </Suspense>
  )
}
