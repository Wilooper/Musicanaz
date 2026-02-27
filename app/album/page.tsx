"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ChevronLeft, Clock, Loader2, Play, Shuffle, Disc3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import ImageWithFallback from "@/components/image-with-fallback"
import { useAudio } from "@/lib/audio-context"
import { addToRecentlyPlayed } from "@/lib/storage"

function getBestThumb(thumbnails: any[]): string {
  if (!thumbnails?.length) return ""
  const sorted = [...thumbnails].sort((a, b) => (b?.width || 0) - (a?.width || 0))
  const t = sorted[0]
  return typeof t === "string" ? t : t?.url || ""
}

function toArtistStr(artists: any): string {
  if (!artists) return "Unknown"
  if (typeof artists === "string") return artists
  if (Array.isArray(artists)) return artists.map((a: any) => (typeof a === "string" ? a : a?.name || "")).join(", ")
  return "Unknown"
}

function AlbumContent() {
  const router = useRouter()
  const params = useSearchParams()
  const id     = params.get("id")
  const { playSong } = useAudio()
  const [album,   setAlbum]   = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    fetch(`/api/musiva/album?id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(data => { setAlbum(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  )
  if (!album) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <p>Album not found</p>
      <Button onClick={() => router.back()}>Go back</Button>
    </div>
  )

  // New backend: thumbnail is top-level string, thumbnails is sorted array
  const thumb     = album.thumbnail || getBestThumb(album.thumbnails || [])
  const tracks    = album.tracks || []
  const artistStr = toArtistStr(album.artists)
  const firstArtistId = Array.isArray(album.artists) ? (album.artists[0]?.id || album.artists[0]?.browseId) : null

  const playTrack = (track: any, auto = false) => {
    if (!track.videoId) return
    const song = {
      id:        track.videoId,
      title:     track.title || "Unknown",
      artist:    toArtistStr(track.artists) || artistStr,
      thumbnail: track.thumbnail || getBestThumb(track.thumbnails || []) || thumb,
      type:      "musiva" as const,
      videoId:   track.videoId,
      duration:  track.duration || "",
      album:     album.title || "",
    }
    playSong(song, !auto)
    addToRecentlyPlayed(song)
    router.push(`/player?id=${encodeURIComponent(song.id)}&title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}&thumbnail=${encodeURIComponent(song.thumbnail)}&type=musiva&videoId=${encodeURIComponent(song.videoId || "")}`)
  }

  const playAll = (shuffle = false) => {
    const list = tracks.filter((t: any) => t.videoId)
    if (!list.length) return
    const ordered = shuffle ? [...list].sort(() => Math.random() - 0.5) : list
    playTrack(ordered[0])
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background">
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-semibold truncate">{album.title}</span>
      </div>

      <div className="container mx-auto px-4 pb-36">
        {/* Album hero */}
        <div className="flex flex-col sm:flex-row gap-6 py-8 items-start">
          <div className="w-48 h-48 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl bg-muted mx-auto sm:mx-0">
            <ImageWithFallback
              src={thumb}
              alt={album.title}
              className="w-full h-full object-cover"
              fallback={<div className="w-full h-full flex items-center justify-center"><Disc3 className="w-12 h-12 text-muted-foreground" /></div>}
            />
          </div>
          <div className="flex flex-col justify-end text-center sm:text-left">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">{album.type || "Album"}</p>
            <h1 className="text-3xl font-bold mb-2">{album.title}</h1>
            <p
              className={`font-medium mb-1 ${firstArtistId ? "text-primary cursor-pointer hover:underline" : "text-muted-foreground"}`}
              onClick={() => firstArtistId && router.push(`/artist?id=${firstArtistId}`)}
            >
              {artistStr}
            </p>
            <p className="text-sm text-muted-foreground">
              {[album.year, tracks.length && `${tracks.length} tracks`, album.duration].filter(Boolean).join(" · ")}
            </p>
            {album.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2 max-w-md">{album.description}</p>
            )}
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
              <Clock className="w-3.5 h-3.5" />
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
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{track.title}</p>
                  {track.artists && (
                    <p className="text-xs text-muted-foreground truncate">{toArtistStr(track.artists)}</p>
                  )}
                  {track.isExplicit && (
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded mt-0.5 inline-block">E</span>
                  )}
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

export default function AlbumPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>}>
      <AlbumContent />
    </Suspense>
  )
}
