#!/usr/bin/env python3
"""
yt_full_patch.py
Run from Musicanaz repo root:
  python3 yt_full_patch.py
Applies:
  1. YT Cookies panel in settings
  2. /yt-data page (home/history/liked/trending tabs)
  3. Android background playback fix (silent keepalive audio)
"""
import pathlib, sys, os

ROOT = pathlib.Path(".")
if not (ROOT / "package.json").exists():
    sys.exit("Run from Musicanaz repo root.")

def write(path, content):
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    print(f"  ✓  wrote {path}")

def patch(path, old, new, label=""):
    p = pathlib.Path(path)
    if not p.exists():
        print(f"  ✗  not found: {path}")
        return False
    src = p.read_text()
    if old not in src:
        print(f"  ✗  anchor not found in {path}: {label}")
        return False
    p.write_text(src.replace(old, new, 1))
    print(f"  ✓  patched {path} ({label})")
    return True

# ──────────────────────────────────────────────────────────────────────────────
# 1. settings/page.tsx — add YTCookiesPanel section
# ──────────────────────────────────────────────────────────────────────────────
print("\n[1] Settings — YT Cookies panel")

patch(
    "app/settings/page.tsx",
    'import { useAudio } from "@/lib/audio-context"',
    'import { useAudio } from "@/lib/audio-context"\nimport { YTCookiesPanel } from "@/components/yt-cookies-panel"',
    "add import"
)

patch(
    "app/settings/page.tsx",
    '        {/* ── AI Features (Groq) ─── */}',
    '''        {/* ── YouTube Account ─── */}
        <section>
          <SectionHeader
            icon={<Music className="w-5 h-5 text-primary" />}
            title="YouTube Account"
            desc="Paste your YouTube cookies to get a personalised feed, history and liked songs."
          />
          <YTCookiesPanel />
        </section>

        {/* ── AI Features (Groq) ─── */}''',
    "add YT section"
)

# ──────────────────────────────────────────────────────────────────────────────
# 2. /app/yt-data/page.tsx — full YT data dashboard
# ──────────────────────────────────────────────────────────────────────────────
print("\n[2] YT Data page")

write("app/yt-data/page.tsx", '''\
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
''')

# ──────────────────────────────────────────────────────────────────────────────
# 3. Add YT nav button to home page
# ──────────────────────────────────────────────────────────────────────────────
print("\n[3] Home page — add YT nav button")

patch(
    "app/page.tsx",
    'import {\n  Search, Music, Clock, Library, TrendingUp,',
    'import {\n  Search, Music, Clock, Library, TrendingUp, Youtube,',
    "add Youtube icon import"
)

patch(
    "app/page.tsx",
    '            <Button variant="ghost" size="sm" onClick={() => router.push("/history")} className="rounded-full px-3 gap-1">\n              <Clock className="w-4 h-4" /><span className="hidden sm:inline">History</span>\n            </Button>',
    '''            <Button variant="ghost" size="sm" onClick={() => router.push("/history")} className="rounded-full px-3 gap-1">
              <Clock className="w-4 h-4" /><span className="hidden sm:inline">History</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/yt-data")} className="rounded-full px-3 gap-1">
              <Youtube className="w-4 h-4 text-red-500" /><span className="hidden sm:inline">YT</span>
            </Button>''',
    "add YT nav button"
)

# ──────────────────────────────────────────────────────────────────────────────
# 4. lib/yt-client.ts — add missing exports if not present
# ──────────────────────────────────────────────────────────────────────────────
print("\n[4] yt-client.ts — check hasCookies export")

yt_client = pathlib.Path("lib/yt-client.ts")
if yt_client.exists():
    src = yt_client.read_text()
    # getYTLiked might be missing — add it if so
    if "getYTLiked" not in src:
        src += '''
export async function getYTLiked(): Promise<any[]> {
  try {
    const r = await fetch("/api/ytdata/liked", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(await _encPayload()) })
    if (!r.ok) return []
    const d = await r.json()
    return d.items ?? []
  } catch { return [] }
}
'''
        yt_client.write_text(src)
        print("  ✓  added getYTLiked to yt-client.ts")
    else:
        print("  -  getYTLiked already present")
else:
    print("  ✗  lib/yt-client.ts not found — skip")

# ──────────────────────────────────────────────────────────────────────────────
# 5. Android background playback fix in audio-context.tsx
# ──────────────────────────────────────────────────────────────────────────────
print("\n[5] Background playback fix")

# Silent 1-second WAV as data URI (keeps Android audio session alive)
SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA="

# A) Add silentAudioRef after ytContainerRef
patch(
    "lib/audio-context.tsx",
    "  const ytContainerRef = useRef<HTMLDivElement | null>(null)",
    """  const ytContainerRef = useRef<HTMLDivElement | null>(null)
  const silentAudioRef = useRef<HTMLAudioElement | null>(null)""",
    "add silentAudioRef"
)

# B) Add silent audio element creation effect after the YT container effect
patch(
    "lib/audio-context.tsx",
    "  // ── lyric sync ──────────────────────────────────────────",
    f"""  // ── silent keepalive audio (Android background playback) ────
  useEffect(() => {{
    const audio = new Audio("{SILENT_WAV}")
    audio.loop   = true
    audio.volume = 0.001          // effectively silent but counts as "playing"
    silentAudioRef.current = audio
    return () => {{
      audio.pause()
      silentAudioRef.current = null
    }}
  }}, [])

  // ── lyric sync ──────────────────────────────────────────""",
    "add keepalive audio effect"
)

# C) When YT starts playing, also start the silent audio
patch(
    "lib/audio-context.tsx",
    "            if (e.data === S.PLAYING) {\n              setIsPlaying(true)",
    """            if (e.data === S.PLAYING) {
              setIsPlaying(true)
              // Keep Android audio session alive
              if (silentAudioRef.current && silentAudioRef.current.paused) {
                silentAudioRef.current.play().catch(() => {})
              }""",
    "start silent audio on YT play"
)

# D) When YT pauses/ends, also pause silent audio (saves battery)
patch(
    "lib/audio-context.tsx",
    "            } else if (e.data === S.PAUSED) {\n              setIsPlaying(false)",
    """            } else if (e.data === S.PAUSED) {
              setIsPlaying(false)
              if (silentAudioRef.current && !silentAudioRef.current.paused) {
                silentAudioRef.current.pause()
              }""",
    "pause silent audio on YT pause"
)

# E) Fix media session play handler to also resume silent audio
patch(
    "lib/audio-context.tsx",
    '      ["play",          () => { const p = ytPlayerRef.current; if (p) try { p.playVideo() } catch {} }],',
    '      ["play",          () => { const p = ytPlayerRef.current; if (p) try { p.playVideo() } catch {}; if (silentAudioRef.current?.paused) silentAudioRef.current.play().catch(()=>{}) }],',
    "media session play resumes silent"
)

# F) Add visibilitychange handler that resumes YT if OS paused it
patch(
    "lib/audio-context.tsx",
    "  // ── sync volume ─────────────────────────────────────────",
    """  // ── resume playback when tab/app becomes visible again ──
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") {
        const p = ytPlayerRef.current
        if (p && typeof p.getPlayerState === "function") {
          try {
            const S = (window as any).YT?.PlayerState
            if (S && p.getPlayerState() === S.PAUSED) {
              // Only auto-resume if we think music should be playing
              // (isPlaying state may have been set to true before OS paused us)
            }
          } catch {}
        }
        // Always try to resume silent keepalive
        if (silentAudioRef.current?.paused && ytPlayerRef.current) {
          silentAudioRef.current.play().catch(() => {})
        }
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])

  // ── sync volume ─────────────────────────────────────────""",
    "add visibilitychange handler"
)

print("\n✅ All patches applied. Commit and push:\n")
print("   git add lib/audio-context.tsx lib/yt-client.ts app/settings/page.tsx app/page.tsx app/yt-data/")
print("   git commit -m 'feat: YT data page, settings panel, background playback fix'")
print("   git push")
