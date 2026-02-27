"use client"

import { useEffect, useState, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ChevronLeft, Clock, Loader2, Play, Radio, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import ImageWithFallback from "@/components/image-with-fallback"
import { useAudio } from "@/lib/audio-context"
import { addToRecentlyPlayed } from "@/lib/storage"

function fmt(s: number) {
  if (!s || isNaN(s)) return ""
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, "0")}`
}

function PodcastContent() {
  const router = useRouter()
  const params = useSearchParams()
  const id     = params.get("id")
  const { playSong } = useAudio()

  const [podcast, setPodcast]   = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [error,   setError]     = useState(false)
  const [playing, setPlaying]   = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/musiva/podcast?id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(true); setLoading(false); return }
        setPodcast(data)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/10">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading podcast…</p>
      </div>
    </div>
  )

  if (error || !podcast) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground bg-gradient-to-br from-background via-background to-accent/10">
      <AlertCircle className="w-12 h-12 opacity-30" />
      <p className="font-medium">Podcast not found</p>
      <p className="text-sm opacity-60">This podcast may not be available</p>
      <Button onClick={() => router.back()} variant="outline" className="rounded-full mt-2">
        Go Back
      </Button>
    </div>
  )

  const episodes: any[] = podcast.episodes || []

  const playEpisode = (ep: any) => {
    if (!ep.videoId) return
    setPlaying(ep.videoId)
    const song = {
      id:           ep.videoId,
      title:        ep.title,
      artist:       ep.artist || podcast.title || "Podcast",
      thumbnail:    ep.thumbnail || podcast.thumbnail || "",
      type:         "musiva" as const,
      videoId:      ep.videoId,
      duration:     ep.duration || "",
      isPodcast:    true,
      podcastId:    id || "",
      podcastTitle: podcast.title || "",
    }
    playSong(song, true)
    addToRecentlyPlayed(song)
    router.push(
      `/player?id=${encodeURIComponent(song.id)}&title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}&thumbnail=${encodeURIComponent(song.thumbnail)}&type=musiva&videoId=${encodeURIComponent(song.videoId)}&isPodcast=1&podcastId=${encodeURIComponent(id || "")}&podcastTitle=${encodeURIComponent(podcast.title || "")}`
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full flex-shrink-0">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-2 min-w-0">
          <Radio className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="font-semibold truncate">{podcast.title}</span>
        </div>
      </div>

      <div className="container mx-auto px-4 pb-36 max-w-3xl">
        {/* Hero */}
        <div className="flex flex-col sm:flex-row gap-5 py-6 items-start">
          <div className="w-36 h-36 sm:w-44 sm:h-44 flex-shrink-0 rounded-2xl overflow-hidden shadow-2xl bg-muted mx-auto sm:mx-0">
            <ImageWithFallback
              src={podcast.thumbnail}
              alt={podcast.title}
              className="w-full h-full object-cover"
              fallback={<div className="w-full h-full flex items-center justify-center"><Radio className="w-12 h-12 text-muted-foreground opacity-30" /></div>}
            />
          </div>
          <div className="flex flex-col justify-end text-center sm:text-left">
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Podcast</p>
            <h1 className="text-2xl sm:text-3xl font-bold mb-1 leading-tight">{podcast.title}</h1>
            {podcast.author && <p className="text-muted-foreground text-sm mb-2">{podcast.author}</p>}
            {podcast.description && (
              <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 max-w-lg">{podcast.description}</p>
            )}
            <p className="text-sm text-muted-foreground mt-2 font-medium">{episodes.length} episodes</p>
          </div>
        </div>

        {/* Episodes */}
        {episodes.length > 0 ? (
          <div>
            <h2 className="text-base font-bold mb-3 text-muted-foreground uppercase tracking-wider text-xs">Episodes</h2>
            <div className="space-y-1">
              {episodes.map((ep: any, idx: number) => (
                <div
                  key={ep.videoId || idx}
                  onClick={() => playEpisode(ep)}
                  className={[
                    "group flex items-center gap-3 p-3 sm:p-4 rounded-2xl cursor-pointer transition-all",
                    playing === ep.videoId
                      ? "bg-primary/15 border border-primary/30"
                      : "hover:bg-card/60 border border-transparent hover:border-border/30",
                  ].join(" ")}
                >
                  {/* Thumbnail */}
                  <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0 relative">
                    <ImageWithFallback
                      src={ep.thumbnail}
                      alt={ep.title}
                      className="w-full h-full object-cover"
                      fallback={<div className="w-full h-full flex items-center justify-center bg-primary/10"><Radio className="w-5 h-5 text-primary/40" /></div>}
                    />
                    <div className={[
                      "absolute inset-0 bg-primary/60 flex items-center justify-center transition-opacity",
                      playing === ep.videoId ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                    ].join(" ")}>
                      <Play className="w-5 h-5 text-white" fill="currentColor" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm leading-snug line-clamp-2 ${playing === ep.videoId ? "text-primary" : ""}`}>
                      {ep.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {ep.date && <span className="text-xs text-muted-foreground">{ep.date}</span>}
                      {ep.duration && (
                        <>
                          {ep.date && <span className="text-muted-foreground/30 text-xs">·</span>}
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />{ep.duration}
                          </span>
                        </>
                      )}
                    </div>
                    {ep.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1 hidden sm:block">{ep.description}</p>
                    )}
                  </div>

                  {/* Episode number */}
                  <span className="text-xs text-muted-foreground/40 flex-shrink-0 hidden sm:block tabular-nums">
                    {idx + 1}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-20 text-muted-foreground">
            <Radio className="w-12 h-12 opacity-20 mx-auto mb-4" />
            <p className="font-medium">No episodes found</p>
            <p className="text-sm mt-1 opacity-60">This podcast may have restricted access</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function PodcastPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-accent/10">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <PodcastContent />
    </Suspense>
  )
}
