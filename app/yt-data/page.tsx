"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ChevronLeft, Home, Clock, Heart, TrendingUp, RefreshCw, Youtube, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import ImageWithFallback from "@/components/image-with-fallback"
import { useAudio } from "@/lib/audio-context"
import { hasCookies } from "@/lib/storage"
import {
  getYTHome, getYTHistory, getYTLiked, getYTTrending, ytItemToSong
} from "@/lib/yt-client"
import type { Song } from "@/lib/types"

type Tab = "home" | "history" | "liked" | "trending"

interface YTItem {
  id: string
  title: string
  artist: string
  thumbnail: string
  duration?: string
}

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "home",     label: "For You",  icon: <Home     className="w-4 h-4" /> },
  { id: "history",  label: "History",  icon: <Clock    className="w-4 h-4" /> },
  { id: "liked",    label: "Liked",    icon: <Heart    className="w-4 h-4" /> },
  { id: "trending", label: "Trending", icon: <TrendingUp className="w-4 h-4" /> },
]

export default function YTDataPage() {
  const router   = useRouter()
  const { playSong } = useAudio()

  const [tab,     setTab]     = useState<Tab>("home")
  const [items,   setItems]   = useState<YTItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [hasAuth, setHasAuth] = useState(false)

  useEffect(() => { setHasAuth(hasCookies()) }, [])

  const load = useCallback(async (t: Tab) => {
    setLoading(true)
    setError(null)
    setItems([])
    try {
      let raw: any[] = []
      if (t === "home")     raw = await getYTHome()
      if (t === "history")  raw = await getYTHistory()
      if (t === "liked")    raw = await getYTLiked()
      if (t === "trending") raw = await getYTTrending()
      setItems(raw.slice(0, 50))
    } catch (e: any) {
      setError(e?.message ?? "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { if (hasAuth) load(tab) }, [tab, hasAuth, load])

  const play = (item: YTItem) => {
    const song: Song = {
      id:        item.id,
      title:     item.title,
      artist:    item.artist,
      thumbnail: item.thumbnail,
      videoId:   item.id,
      type:      "yt",
      duration:  item.duration ?? "",
      album:     "",
    }
    playSong(song, true)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* header */}
      <div className="sticky top-0 z-40 bg-background/90 backdrop-blur border-b border-border/40">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-full" onClick={() => router.back()}>
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Youtube className="w-5 h-5 text-red-500" />
          <span className="font-semibold text-lg">YouTube</span>
          <div className="flex-1" />
          {hasAuth && (
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => load(tab)}>
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>

        {/* tabs */}
        {hasAuth && (
          <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-1 overflow-x-auto no-scrollbar">
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors
                  ${tab === t.id
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
              >
                {t.icon}{t.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="max-w-2xl mx-auto px-4 py-4">
        {/* not connected */}
        {!hasAuth && (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Lock className="w-7 h-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-lg mb-1">No YouTube account connected</p>
              <p className="text-sm text-muted-foreground">Go to Settings → YouTube Account to paste your cookies.</p>
            </div>
            <Button onClick={() => router.push("/settings")} variant="outline" className="rounded-full">
              Open Settings
            </Button>
          </div>
        )}

        {/* error */}
        {hasAuth && error && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm mb-3">{error}</p>
            <Button variant="outline" size="sm" className="rounded-full" onClick={() => load(tab)}>
              Retry
            </Button>
          </div>
        )}

        {/* skeleton */}
        {hasAuth && loading && (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-2 rounded-xl animate-pulse">
                <div className="w-14 h-14 rounded-lg bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* list */}
        {hasAuth && !loading && !error && items.length > 0 && (
          <div className="space-y-1">
            {items.map((item, idx) => (
              <button
                key={`${item.id}-${idx}`}
                onClick={() => play(item)}
                className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/60 active:bg-muted transition-colors text-left"
              >
                <div className="relative shrink-0">
                  <ImageWithFallback
                    src={item.thumbnail}
                    alt={item.title}
                    width={56}
                    height={56}
                    className="rounded-lg object-cover w-14 h-14"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-snug line-clamp-2">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.artist}</p>
                </div>
                {item.duration && (
                  <span className="text-xs text-muted-foreground shrink-0">{item.duration}</span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* empty */}
        {hasAuth && !loading && !error && items.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-12">Nothing here yet.</p>
        )}
      </div>
    </div>
  )
}
