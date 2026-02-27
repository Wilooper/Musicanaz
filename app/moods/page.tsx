"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Loader2, Music2, Play, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import ImageWithFallback from "@/components/image-with-fallback"
import { useAudio } from "@/lib/audio-context"
import type { MoodCategory, MoodPlaylist } from "@/lib/types"

const MOOD_GRADIENTS = [
  "from-purple-600 to-pink-600",
  "from-blue-600 to-cyan-500",
  "from-green-600 to-emerald-500",
  "from-orange-500 to-red-500",
  "from-yellow-500 to-orange-500",
  "from-indigo-600 to-purple-600",
  "from-pink-500 to-rose-500",
  "from-teal-600 to-green-500",
  "from-red-600 to-orange-500",
  "from-violet-600 to-indigo-500",
  "from-sky-500 to-blue-600",
  "from-fuchsia-600 to-pink-500",
]

function MoodSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-2xl bg-card/40 animate-pulse" />
      ))}
    </div>
  )
}

function PlaylistSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-card/40 animate-pulse">
          <div className="aspect-square rounded-xl mb-2" />
          <div className="h-3 w-3/4 bg-muted/60 rounded mb-1 mx-2" />
          <div className="h-2 w-1/2 bg-muted/40 rounded mb-3 mx-2" />
        </div>
      ))}
    </div>
  )
}

function PlaylistCard({ pl, onPlay }: { pl: MoodPlaylist; onPlay: () => void }) {
  return (
    <div
      onClick={onPlay}
      className="group relative bg-card/30 backdrop-blur-sm rounded-2xl p-3 cursor-pointer transition-all duration-300 hover:bg-card/60 hover:scale-[1.03] hover:shadow-2xl border border-border/20 active:scale-95"
    >
      <div className="relative aspect-square mb-3 overflow-hidden rounded-xl bg-muted">
        <ImageWithFallback
          src={pl.thumbnail}
          alt={pl.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          fallback={<div className="w-full h-full flex items-center justify-center bg-primary/10"><Music2 className="w-8 h-8 text-primary/40" /></div>}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 bg-primary rounded-full flex items-center justify-center shadow-xl">
            <Play className="w-5 h-5 text-primary-foreground ml-0.5" fill="currentColor" />
          </div>
        </div>
      </div>
      <h3 className="font-semibold text-sm truncate leading-snug">{pl.title}</h3>
      {pl.subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{pl.subtitle}</p>}
    </div>
  )
}

export default function MoodsPage() {
  const router = useRouter()

  const [categories,       setCategories]       = useState<MoodCategory[]>([])
  const [selectedMood,     setSelectedMood]     = useState<MoodCategory | null>(null)
  const [moodPlaylists,    setMoodPlaylists]    = useState<MoodPlaylist[]>([])
  const [catLoading,       setCatLoading]       = useState(true)
  const [catError,         setCatError]         = useState(false)
  const [playlistsLoading, setPlaylistsLoading] = useState(false)
  const [playlistsError,   setPlaylistsError]   = useState(false)

  const fetchCategories = async () => {
    setCatLoading(true)
    setCatError(false)
    try {
      const res  = await fetch("/api/musiva/mood")
      const data = await res.json()
      const cats: MoodCategory[] = Array.isArray(data) ? data : []
      setCategories(cats)
      if (!cats.length) setCatError(true)
    } catch {
      setCatError(true)
    } finally {
      setCatLoading(false)
    }
  }

  useEffect(() => { fetchCategories() }, [])

  const loadMoodPlaylists = async (mood: MoodCategory) => {
    if (!mood.params) return
    setSelectedMood(mood)
    setMoodPlaylists([])
    setPlaylistsLoading(true)
    setPlaylistsError(false)
    try {
      const res  = await fetch(`/api/musiva/mood?params=${encodeURIComponent(mood.params)}`)
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const list: MoodPlaylist[] = Array.isArray(data) ? data : []
      setMoodPlaylists(list)
      if (!list.length) setPlaylistsError(true)
    } catch {
      setPlaylistsError(true)
    } finally {
      setPlaylistsLoading(false)
    }
  }

  // Group categories by section
  const sections = categories.reduce<Record<string, MoodCategory[]>>((acc, cat) => {
    const key = cat.section || "Moods & Genres"
    if (!acc[key]) acc[key] = []
    acc[key].push(cat)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <Button
          variant="ghost" size="icon"
          onClick={selectedMood ? () => { setSelectedMood(null); setMoodPlaylists([]) } : () => router.push("/")}
          className="rounded-full"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <Music2 className="w-5 h-5 text-primary" />
        <span className="font-semibold flex-1 truncate">
          {selectedMood ? selectedMood.title : "Moods & Genres"}
        </span>
        {selectedMood && (
          <Button
            variant="ghost" size="sm"
            className="rounded-full text-xs text-muted-foreground flex-shrink-0"
            onClick={() => { setSelectedMood(null); setMoodPlaylists([]) }}
          >
            ← All moods
          </Button>
        )}
      </div>

      <div className="container mx-auto px-4 py-6 pb-36">
        {!selectedMood ? (
          /* ── Category grid ── */
          catLoading ? (
            <MoodSkeleton />
          ) : catError ? (
            <div className="text-center py-32 text-muted-foreground">
              <Music2 className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <p className="text-lg font-medium mb-2">Couldn't load moods</p>
              <Button variant="outline" size="sm" onClick={fetchCategories} className="gap-2">
                <RefreshCw className="w-4 h-4" /> Try again
              </Button>
            </div>
          ) : categories.length > 0 ? (
            Object.entries(sections).map(([sectionTitle, cats]) => (
              <section key={sectionTitle} className="mb-10">
                <h2 className="text-base font-bold mb-4 text-foreground/80 uppercase tracking-wider text-xs">{sectionTitle}</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {cats.map((cat, idx) => {
                    const gradient = MOOD_GRADIENTS[idx % MOOD_GRADIENTS.length]
                    return (
                      <button
                        key={idx}
                        onClick={() => loadMoodPlaylists(cat)}
                        className={`relative overflow-hidden rounded-2xl aspect-square bg-gradient-to-br ${gradient} p-4 text-left hover:scale-[1.04] active:scale-95 transition-all duration-200 shadow-lg group`}
                      >
                        {cat.thumbnail && (
                          <img
                            src={cat.thumbnail}
                            alt={cat.title}
                            className="absolute inset-0 w-full h-full object-cover mix-blend-overlay opacity-30 group-hover:opacity-50 transition-opacity"
                          />
                        )}
                        <span className="relative z-10 text-white font-bold text-sm leading-snug drop-shadow-md">
                          {cat.title}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </section>
            ))
          ) : (
            <div className="text-center py-32 text-muted-foreground">
              <Music2 className="w-14 h-14 mx-auto mb-4 opacity-20" />
              <p>No moods found</p>
            </div>
          )
        ) : (
          /* ── Mood playlists ── */
          <div>
            <div className="flex items-center gap-3 mb-6">
              {selectedMood.thumbnail && (
                <div
                  className="w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-primary/30 to-accent/30"
                >
                  <ImageWithFallback src={selectedMood.thumbnail} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div>
                <h2 className="text-2xl font-bold leading-tight">{selectedMood.title}</h2>
                {moodPlaylists.length > 0 && (
                  <p className="text-sm text-muted-foreground">{moodPlaylists.length} playlists</p>
                )}
              </div>
            </div>

            {playlistsLoading ? (
              <PlaylistSkeleton />
            ) : playlistsError ? (
              <div className="text-center py-24 text-muted-foreground">
                <Music2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="font-medium mb-3">No playlists found for this mood</p>
                <Button variant="outline" size="sm" onClick={() => loadMoodPlaylists(selectedMood)} className="gap-2">
                  <RefreshCw className="w-4 h-4" /> Retry
                </Button>
              </div>
            ) : moodPlaylists.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {moodPlaylists.map((pl, idx) => (
                  <PlaylistCard
                    key={idx}
                    pl={pl}
                    onPlay={() => {
                      if (pl.browseId) router.push(`/playlist?id=${pl.browseId}`)
                    }}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
