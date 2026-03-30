"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import {
  Search, Music, Clock, Library, TrendingUp,
  BarChart3, Home, X, Loader2, ChevronRight,
  Mic2, Disc3, ListMusic, Radio, Video, Music2,
  Settings, Globe, Play, ClipboardPaste, Sparkles, Zap,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import SongCard from "@/components/song-card"
import ImageWithFallback from "@/components/image-with-fallback"
import { getRecentlyPlayed, getCountry, getPreferences, savePreferences } from "@/lib/storage"
import { getAISearchEnabled, setAISearchEnabled, aiPersonalizedSearch, getAIRecommendations, aiSongToSong, runAIAnalysis } from "@/lib/ai-client"
import { getLocalData, getStats as getLocalStats, type TasteAnalysis } from "@/lib/local-data"
import { getOrCreateUID } from "@/lib/uid"
import { getAISearchEnabled, setAISearchEnabled, aiPersonalizedSearch, getAIRecommendations, getCollabSignals, aiSongToSong } from "@/lib/ai-client"
import type { Song, MusivaTrack } from "@/lib/types"
import { useRouter } from "next/navigation"
import { useAudio } from "@/lib/audio-context"

/* ─── helpers ─────────────────────────────────────────── */
// Quality rank for YouTube thumbnail URLs (higher = better)
function ytQuality(url: string): number {
  if (!url) return 0
  if (url.includes("maxresdefault")) return 7
  if (url.includes("sddefault"))    return 6
  if (url.includes("hqdefault"))    return 5
  if (url.includes("mqdefault"))    return 4
  if (url.includes("0.jpg") || url.includes("0.webp")) return 3  // numbered wide thumb
  if (url.includes("default"))      return 2
  return 1
}

function getBestThumbnail(thumbnails: any, fallback = ""): string {
  if (!thumbnails && !fallback) return ""
  if (typeof thumbnails === "string") return thumbnails || fallback
  if (!Array.isArray(thumbnails) || !thumbnails.length) return fallback
  // Sort by explicit width first, then URL quality heuristic
  const sorted = [...thumbnails].sort((a, b) => {
    const aw = typeof a === "string" ? 0 : (a?.width || 0)
    const bw = typeof b === "string" ? 0 : (b?.width || 0)
    if (bw !== aw) return bw - aw
    const aUrl = typeof a === "string" ? a : (a?.url || "")
    const bUrl = typeof b === "string" ? b : (b?.url || "")
    return ytQuality(bUrl) - ytQuality(aUrl)
  })
  const t = sorted[0]
  const best = typeof t === "string" ? t : (t?.url || "")
  return best || fallback
}

function toArtistStr(artists: any): string {
  if (!artists) return "Unknown"
  if (typeof artists === "string") return artists
  if (Array.isArray(artists))
    return artists.map((a: any) => typeof a === "string" ? a : a?.name || "").filter(Boolean).join(", ") || "Unknown"
  return "Unknown"
}

function convertToSong(track: any): Song {
  // Handle Deezer tracks where artist is an object { name, ... }
  const artistStr = typeof track.artist === "string"
    ? track.artist
    : track.artist?.name
      ? track.artist.name
      : toArtistStr(track.artists)
  return {
    id:        track.videoId || track.id || "",
    title:     track.title  || "Unknown",
    artist:    artistStr,
    thumbnail: getBestThumbnail(track.thumbnails, track.thumbnail),
    type:      "musiva",
    videoId:   track.videoId || "",
    album:     typeof track.album === "string" ? track.album : track.album?.name || track.album?.title || "",
    duration:  track.duration || "",
  }
}

/** Resolve a YouTube videoId by reverse-searching title + artist on the backend */
async function resolveVideoId(title: string, artist: string): Promise<string> {
  try {
    const q = `${title} ${artist}`.trim()
    const res = await fetch(
      `/api/musiva/search?q=${encodeURIComponent(q)}&filter=songs&limit=1`
    )
    if (!res.ok) return ""
    const data = await res.json()
    return data.results?.[0]?.videoId || ""
  } catch {
    return ""
  }
}

/* ─── Skeletons ──────────────────────────────────────── */
function CardSkeleton() {
  return (
    <div className="bg-card/30 rounded-2xl p-3 animate-pulse">
      <div className="aspect-square bg-muted/60 rounded-xl mb-3" />
      <div className="h-3 bg-muted/60 rounded mb-1.5 w-4/5" />
      <div className="h-2.5 bg-muted/40 rounded w-3/5" />
    </div>
  )
}
function CardGrid({ n = 12, cols = "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6" }: { n?: number; cols?: string }) {
  return (
    <div className={`grid ${cols} gap-3`}>
      {Array.from({ length: n }).map((_, i) => <CardSkeleton key={i} />)}
    </div>
  )
}
function ShelfSkeleton() {
  return (
    <section className="mb-10">
      <div className="h-5 bg-muted/40 rounded w-40 mb-4 animate-pulse" />
      <CardGrid n={6} />
    </section>
  )
}

/* ─── Result card variants ───────────────────────────── */
const GRID = "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3"

function ArtistCard({ item, onClick }: { item: any; onClick: () => void }) {
  const thumb = getBestThumbnail(item.thumbnails, item.thumbnail)
  return (
    <div onClick={onClick} className="group flex flex-col items-center text-center cursor-pointer p-3 rounded-2xl bg-card/30 hover:bg-card/60 hover:scale-105 transition-all border border-border/20">
      <div className="w-full aspect-square rounded-full overflow-hidden bg-muted mb-3 ring-2 ring-transparent group-hover:ring-primary transition-all">
        <ImageWithFallback
          src={thumb}
          alt={item.name}
          className="w-full h-full object-cover"
          fallback={<div className="w-full h-full flex items-center justify-center"><Mic2 className="w-7 h-7 text-muted-foreground" /></div>}
        />
      </div>
      <p className="font-semibold text-xs truncate w-full">{item.name || item.title || "Artist"}</p>
      <p className="text-[11px] text-muted-foreground truncate w-full">{item.subscribers || "Artist"}</p>
    </div>
  )
}

function AlbumCard({ item, onClick }: { item: any; onClick: () => void }) {
  const thumb = getBestThumbnail(item.thumbnails, item.thumbnail)
  return (
    <div onClick={onClick} className="group cursor-pointer bg-card/30 rounded-2xl p-3 hover:bg-card/60 hover:scale-105 transition-all border border-border/20">
      <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-muted">
        <ImageWithFallback
          src={thumb}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
          fallback={<div className="w-full h-full flex items-center justify-center"><Disc3 className="w-7 h-7 text-muted-foreground" /></div>}
        />
      </div>
      <p className="font-semibold text-xs truncate">{item.title}</p>
      <p className="text-[11px] text-muted-foreground truncate">{toArtistStr(item.artists)}{item.year ? ` · ${item.year}` : ""}</p>
    </div>
  )
}

function PlaylistCard({ item, onClick }: { item: any; onClick: () => void }) {
  const thumb = getBestThumbnail(item.thumbnails, item.thumbnail)
  return (
    <div onClick={onClick} className="group cursor-pointer bg-card/30 rounded-2xl p-3 hover:bg-card/60 hover:scale-105 transition-all border border-border/20 relative overflow-hidden">
      <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-muted">
        <ImageWithFallback
          src={thumb}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
          fallback={<div className="w-full h-full flex items-center justify-center"><ListMusic className="w-7 h-7 text-muted-foreground" /></div>}
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
            <Play className="w-4 h-4 text-primary-foreground ml-0.5" fill="currentColor" />
          </div>
        </div>
      </div>
      <p className="font-semibold text-xs truncate">{item.title}</p>
      <p className="text-[11px] text-muted-foreground truncate">{item.author || item.itemCount || "Playlist"}</p>
    </div>
  )
}

function PodcastCard({ item, onClick }: { item: any; onClick: () => void }) {
  const thumb = getBestThumbnail(item.thumbnails, item.thumbnail)
  return (
    <div onClick={onClick} className="group cursor-pointer bg-card/30 rounded-2xl p-3 hover:bg-card/60 hover:scale-105 transition-all border border-border/20">
      <div className="aspect-square rounded-xl overflow-hidden mb-2 bg-muted">
        <ImageWithFallback
          src={thumb}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
          fallback={<div className="w-full h-full flex items-center justify-center"><Radio className="w-7 h-7 text-muted-foreground" /></div>}
        />
      </div>
      <p className="font-semibold text-xs truncate">{item.title}</p>
      <p className="text-[11px] text-muted-foreground truncate">{item.author || "Podcast"}</p>
    </div>
  )
}

/* ─── Charts artists strip ───────────────────────────── */
function ChartsArtistsRow({ artists }: { artists: any[] }) {
  const router = useRouter()
  if (!artists.length) return null
  return (
    <section className="mb-8">
      <h3 className="text-base font-bold mb-3">Top Artists</h3>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {artists.map((a: any, i: number) => {
          const thumb = getBestThumbnail(a.thumbnails, a.thumbnail)
          return (
            <div
              key={i}
              onClick={() => a.browseId && router.push(`/artist?id=${a.browseId}`)}
              className="flex-shrink-0 w-20 text-center cursor-pointer group"
            >
              <div className="w-16 h-16 rounded-full overflow-hidden bg-muted mx-auto mb-1.5 ring-2 ring-transparent group-hover:ring-primary transition-all">
                <ImageWithFallback
                  src={thumb}
                  alt={a.name}
                  className="w-full h-full object-cover"
                  fallback={<div className="w-full h-full flex items-center justify-center"><Mic2 className="w-5 h-5 text-muted-foreground" /></div>}
                />
              </div>
              <p className="text-[11px] font-medium truncate">{a.name || a.title}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/* ─── Load More button ────────────────────────────────── */
function LoadMoreBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <div className="flex justify-center mt-6">
      <Button
        variant="outline"
        onClick={onClick}
        disabled={loading}
        className="rounded-full px-8 gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
        {loading ? "Loading…" : "Load More"}
      </Button>
    </div>
  )
}

/* ─── Trending Countries ─────────────────────────────── */
const TRENDING_COUNTRIES = [
  { code: "ZZ", flag: "🌍", name: "Global"       },
  { code: "US", flag: "🇺🇸", name: "US"           },
  { code: "IN", flag: "🇮🇳", name: "India"        },
  { code: "GB", flag: "🇬🇧", name: "UK"           },
  { code: "AU", flag: "🇦🇺", name: "Australia"    },
  { code: "JP", flag: "🇯🇵", name: "Japan"        },
  { code: "KR", flag: "🇰🇷", name: "Korea"        },
  { code: "BR", flag: "🇧🇷", name: "Brazil"       },
  { code: "NG", flag: "🇳🇬", name: "Nigeria"      },
  { code: "MX", flag: "🇲🇽", name: "Mexico"       },
  { code: "FR", flag: "🇫🇷", name: "France"       },
  { code: "DE", flag: "🇩🇪", name: "Germany"      },
  { code: "ZA", flag: "🇿🇦", name: "South Africa" },
  { code: "PH", flag: "🇵🇭", name: "Philippines"  },
  { code: "ID", flag: "🇮🇩", name: "Indonesia"    },
]

/* ─── TrendingCard with rank badge ──────────────────── */
function TrendingCard({ item, rank }: { item: any; rank: number }) {
  const { playSong } = useAudio()
  const [resolving, setResolving] = useState(false)
  const song = convertToSong(item)

  const handlePlay = async () => {
    if (resolving) return
    if (song.videoId) {
      playSong(song)
      return
    }
    // Deezer track — reverse-search backend by title + artist to get YouTube videoId
    setResolving(true)
    const videoId = await resolveVideoId(song.title, song.artist)
    setResolving(false)
    if (videoId) {
      playSong({ ...song, id: videoId, videoId })
    }
  }

  return (
    <div
      onClick={handlePlay}
      className="group cursor-pointer bg-card/30 rounded-2xl p-3 hover:bg-card/60 hover:scale-105 transition-all border border-border/20 relative"
    >
      <div className="aspect-square rounded-xl overflow-hidden bg-muted mb-3 relative">
        <ImageWithFallback
          src={song.thumbnail}
          alt={song.title}
          className="w-full h-full object-cover"
          fallback={<div className="w-full h-full flex items-center justify-center bg-muted"><Music2 className="w-8 h-8 text-muted-foreground" /></div>}
        />
        {/* Rank badge */}
        <div className="absolute top-2 left-2">
          <span className={[
            "text-xs font-bold px-2 py-0.5 rounded-full",
            rank === 1 ? "bg-yellow-400 text-yellow-900" :
            rank === 2 ? "bg-zinc-300 text-zinc-700"     :
            rank === 3 ? "bg-amber-600 text-white"       :
            "bg-black/60 text-white"
          ].join(" ")}>
            #{rank}
          </span>
        </div>
        {/* Play overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition-all">
          {resolving ? (
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          ) : (
            <div className="opacity-0 group-hover:opacity-100 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center transition-all scale-90 group-hover:scale-100">
              <Play className="w-4 h-4 text-black fill-black ml-0.5" />
            </div>
          )}
        </div>
      </div>
      <p className="font-semibold text-xs truncate">{song.title}</p>
      <p className="text-[11px] text-muted-foreground truncate">{song.artist}</p>
    </div>
  )
}

/* ─── Radio Stations ─────────────────────────────────── */
const RADIO_STATIONS = [
  { id: "pop-hits",     label: "🎵 Pop Hits",       query: "top pop hits 2024"             },
  { id: "hip-hop",      label: "🎤 Hip-Hop",         query: "best hip hop songs 2024"       },
  { id: "bollywood",    label: "🇮🇳 Bollywood",      query: "bollywood hits 2024"           },
  { id: "kpop",         label: "🇰🇷 K-Pop",          query: "kpop hits 2024"                },
  { id: "lofi",         label: "☕ Lo-Fi Chill",      query: "lofi hip hop chill beats"      },
  { id: "workout",      label: "💪 Workout",          query: "best workout gym music 2024"   },
  { id: "classical",    label: "🎻 Classical",        query: "best classical music"          },
  { id: "afrobeats",    label: "🎶 Afrobeats",        query: "afrobeats hits 2024"           },
  { id: "latin",        label: "💃 Latin",            query: "reggaeton latin hits 2024"     },
  { id: "rock",         label: "🎸 Rock",             query: "best rock songs"               },
]

function RadioView() {
  const { playPlaylist } = useAudio()
  const [loading, setLoading] = useState<string | null>(null)

  const startStation = async (station: typeof RADIO_STATIONS[0]) => {
    setLoading(station.id)
    try {
      const res   = await fetch(`/api/musiva/search?q=${encodeURIComponent(station.query)}&filter=songs&limit=20`)
      const data  = await res.json()
      const songs = (data.results || []).map((t: any): Song => ({
        id:        t.videoId || t.id,
        title:     t.title || "Unknown",
        artist:    Array.isArray(t.artists) ? t.artists.map((a: any) => typeof a === "string" ? a : a?.name).join(", ") : (t.artist || "Unknown"),
        thumbnail: t.thumbnail || getBestThumbnail(t.thumbnails),
        type:      "musiva",
        videoId:   t.videoId || t.id,
        duration:  t.duration || "",
      }))
      if (songs.length) playPlaylist(songs, 0)
    } catch {}
    setLoading(null)
  }

  return (
    <section>
      <div className="flex items-center gap-2 mb-5">
        <Radio className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold">Radio</h2>
        <span className="text-xs text-muted-foreground px-2 py-1 rounded-full bg-card/50 border border-border/30 ml-auto">
          {RADIO_STATIONS.length} stations
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {RADIO_STATIONS.map(station => (
          <button
            key={station.id}
            onClick={() => startStation(station)}
            disabled={loading === station.id}
            className="group flex flex-col items-center justify-center gap-2 p-5 rounded-2xl bg-card/40 border border-border/30 hover:bg-card/70 hover:border-primary/40 hover:scale-105 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-wait"
          >
            {loading === station.id ? (
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            ) : (
              <span className="text-3xl group-hover:scale-110 transition-transform">{station.label.split(" ")[0]}</span>
            )}
            <span className="text-xs font-semibold text-center leading-tight">{station.label.split(" ").slice(1).join(" ")}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-4 opacity-60">
        Tap a station to start playing. Stations auto-build a 20-song queue.
      </p>
    </section>
  )
}

/* ─── Types ──────────────────────────────────────────── */
interface Shelf { title: string; contents: MusivaTrack[] }
interface ChartsData { songs: any[]; videos: any[]; artists: any[]; trending: any[] }
type View       = "home" | "results" | "trending" | "charts" | "radio"
type FilterType = "songs" | "videos" | "albums" | "artists" | "playlists" | "podcasts"

const FILTER_TABS: { key: FilterType; label: string; icon: React.ReactNode }[] = [
  { key: "songs",     label: "Songs",     icon: <Music     className="w-3.5 h-3.5" /> },
  { key: "artists",   label: "Artists",   icon: <Mic2      className="w-3.5 h-3.5" /> },
  { key: "albums",    label: "Albums",    icon: <Disc3     className="w-3.5 h-3.5" /> },
  { key: "videos",    label: "Videos",    icon: <Video     className="w-3.5 h-3.5" /> },
  { key: "playlists", label: "Playlists", icon: <ListMusic className="w-3.5 h-3.5" /> },
  { key: "podcasts",  label: "Podcasts",  icon: <Radio     className="w-3.5 h-3.5" /> },
]

/* ─── Main ───────────────────────────────────────────── */
// ─── PWA Install Banner ──────────────────────────────────
function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShow(true)
    }
    window.addEventListener("beforeinstallprompt", handler as any)
    return () => window.removeEventListener("beforeinstallprompt", handler as any)
  }, [])

  if (!show || !deferredPrompt) return null

  const install = async () => {
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setShow(false)
    setDeferredPrompt(null)
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/30">
        <ImageWithFallback src="https://raw.githubusercontent.com/wilooper/Asset/main/logo.png" alt="" className="w-9 h-9 rounded-xl flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Install Musicanaz</p>
          <p className="text-xs opacity-80">Add to your home screen</p>
        </div>
        <button onClick={install} className="px-3 py-1.5 rounded-xl bg-primary-foreground text-primary text-xs font-bold flex-shrink-0">Install</button>
        <button onClick={() => setShow(false)} className="text-primary-foreground/60 hover:text-primary-foreground text-lg leading-none flex-shrink-0">×</button>
      </div>
    </div>
  )
}


export default function HomePage() {
  const router = useRouter()
  const { playSong } = useAudio()

  // ── Share-to-Play state ────────────────────────────────────────────────
  const [shareResolving, setShareResolving] = useState<"idle"|"loading"|"error">("idle")
  const [shareTitle,     setShareTitle]     = useState("")

  // ── Paste & Play state ─────────────────────────────────────────────────
  const [pasteUrl,       setPasteUrl]       = useState<string | null>(null)  // detected YT URL
  const [pasteLabel,     setPasteLabel]     = useState("")                   // display text
  const [pasteLoading,   setPasteLoading]   = useState(false)

  // ── AI state ──────────────────────────────────────────────────────────
  const [aiEnabled,        setAiEnabled]        = useState(false)
  const [aiRecos,          setAiRecos]          = useState<Song[]>([])
  const [aiRecosLoading,   setAiRecosLoading]   = useState(false)
  const [aiCollabSignals,  setAiCollabSignals]  = useState<Song[]>([])
  const [aiSearchLoading,  setAiSearchLoading]  = useState(false)
  const [aiSearchBadge,    setAiSearchBadge]    = useState(false) // "personalized" label

  // ── AI state ────────────────────────────────────────────────────────────
  const [aiEnabled,       setAiEnabled]       = useState(false)
  const [aiAnalysis,      setAiAnalysis]      = useState<TasteAnalysis | null>(null)
  const [aiAnalyzing,     setAiAnalyzing]     = useState(false)
  const [aiAnalysisError, setAiAnalysisError] = useState("")
  const [aiRecos,         setAiRecos]         = useState<Song[]>([])
  const [aiRecosLoading,  setAiRecosLoading]  = useState(false)
  const [aiSearchLoading, setAiSearchLoading] = useState(false)
  const [aiSearchBadge,   setAiSearchBadge]   = useState(false)
  const [localStats,      setLocalStats]      = useState<ReturnType<typeof getLocalStats> | null>(null)

  // Search state
  const [searchQuery,     setSearchQuery]     = useState("")
  const [suggestions,     setSuggestions]     = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestLoading,  setSuggestLoading]  = useState(false)
  const [activeFilter,    setActiveFilter]    = useState<FilterType>("songs")
  const [searchResults,   setSearchResults]   = useState<Record<FilterType, any[]>>({
    songs: [], artists: [], albums: [], videos: [], playlists: [], podcasts: [],
  })
  // offset is computed from searchResults[filter].length
  const [isSearching,    setIsSearching]    = useState(false)
  const [isLoadingMore,  setIsLoadingMore]  = useState(false)
  const [hasMore,        setHasMore]        = useState<Record<FilterType, boolean>>({
    songs: false, artists: false, albums: false, videos: false, playlists: false, podcasts: false,
  })

  // Home / trending / charts state
  const [homeShelves,     setHomeShelves]     = useState<Shelf[]>([])
  const [homeLoading,     setHomeLoading]     = useState(true)
  const [topPlaylists,    setTopPlaylists]    = useState<any[]>([])
  const [topPLLoading,    setTopPLLoading]    = useState(false)
  const [trending,           setTrending]           = useState<MusivaTrack[]>([])
  const [trendingLoading,    setTrendingLoading]    = useState(false)
  const [trendingCountry,    setTrendingCountry]    = useState("ZZ")
  const [trendingLimit,      setTrendingLimit]      = useState(20)
  const [trendingLoadingMore,setTrendingLoadingMore]= useState(false)
  const [trendingSource,     setTrendingSource]     = useState("all")
  const [charts,          setCharts]          = useState<ChartsData>({ songs: [], videos: [], artists: [], trending: [] })
  const [chartsLoading,   setChartsLoading]   = useState(false)
  const [selectedRegion,  setSelectedRegion]  = useState("ZZ")
  const [chartsTab,       setChartsTab]       = useState<"songs" | "videos" | "trending">("songs")
  const [chartsSource,    setChartsSource]    = useState("all")
  const [recentlyPlayed,  setRecentlyPlayed]  = useState<Song[]>([])
  const [activeView,      setActiveView]      = useState<View>("home")

  const searchRef       = useRef<HTMLInputElement>(null)
  const suggestionsRef  = useRef<HTMLDivElement>(null)
  const debounceRef     = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchedQuery   = useRef("")
  const resultsPushed   = useRef(false)

  // Initialise AI toggle from localStorage
  useEffect(() => {
    setAiEnabled(getAISearchEnabled())
  }, [])

  // Init AI from localStorage
  useEffect(() => {
    setAiEnabled(getAISearchEnabled())
    const d = getLocalData()
    if (d?.analysis) setAiAnalysis(d.analysis)
    setLocalStats(getLocalStats())
  }, [])

  // Load country + source prefs on mount
  useEffect(() => {
    const prefs = getPreferences()
    const c = prefs.country || "ZZ"
    setSelectedRegion(c)
    setTrendingCountry(c)
    setTrendingSource(prefs.trendingSource || "all")
    setChartsSource(prefs.chartsSource   || "all")
  }, [])

  // Sync active view with browser history (hash-based)
  useEffect(() => {
    const viewFromHash = (): View => {
      const h = window.location.hash.replace("#", "")
      if (h === "results" || h === "trending" || h === "charts" || h === "radio") return h as View
      return "home"
    }

    const initialView = viewFromHash()
    if (initialView !== "home") setActiveView(initialView)
    const correctUrl = initialView === "home"
      ? window.location.pathname + window.location.search
      : `${window.location.pathname}${window.location.search}#${initialView}`
    window.history.replaceState({ view: initialView }, "", correctUrl)

    const onPopState = (e: PopStateEvent) => {
      const view: View = e.state?.view ?? viewFromHash()
      setActiveView(view)
      if (view === "results") {
        resultsPushed.current = true
      } else {
        resultsPushed.current = false
        setSearchQuery("")
        setSuggestions([])
        setShowSuggestions(false)
      }
    }

    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, []) // eslint-disable-line

  // Loaders
  const loadRecentlyPlayed = useCallback(() => setRecentlyPlayed(getRecentlyPlayed()), [])

  const handleRunAnalysis = useCallback(async () => {
    setAiAnalyzing(true); setAiAnalysisError("")
    try {
      const result = await runAIAnalysis()
      if (result) {
        setAiAnalysis(result.analysis)
        const songs = (result.suggestions || []).map(aiSongToSong).filter((s: Song) => s.videoId)
        setAiRecos(songs)
        setLocalStats(getLocalStats())
      } else {
        setAiAnalysisError("Play at least 3 songs to unlock AI analysis.")
      }
    } catch (e: any) {
      setAiAnalysisError(e.message || "Analysis failed")
    }
    setAiAnalyzing(false)
  }, [])

  const loadAIRecommendations = useCallback(async () => {
    setAiRecosLoading(true)
    try {
      const data = await getAIRecommendations(20)
      const songs = (data.songs || []).map(aiSongToSong).filter((s: Song) => s.videoId)
      setAiRecos(songs)
    } catch { setAiRecos([]) }
    setAiRecosLoading(false)
  }, [])

  const loadAIRecommendations = useCallback(async () => {
    setAiRecosLoading(true)
    try {
      const data = await getAIRecommendations(20)
      const songs = (data.songs || []).map(aiSongToSong).filter((s: Song) => s.videoId)
      setAiRecos(songs)
    } catch { setAiRecos([]) }
    setAiRecosLoading(false)
  }, [])

  const loadAICollabSignals = useCallback(async () => {
    try {
      const data = await getCollabSignals(10)
      const songs = (data.signals || []).map(aiSongToSong).filter((s: Song) => s.videoId)
      setAiCollabSignals(songs)
    } catch { setAiCollabSignals([]) }
  }, [])

  const loadHome = useCallback(async () => {
    setHomeLoading(true)
    try {
      const data = await fetch("/api/musiva/home?limit=6").then(r => r.json())
      setHomeShelves(Array.isArray(data) ? data : data.shelves || [])
    } catch { setHomeShelves([]) }
    setHomeLoading(false)
  }, [])

  // Top Playlists — use the dedicated top-playlists endpoint
  const loadTopPlaylists = useCallback(async () => {
    setTopPLLoading(true)
    try {
      const country = typeof window !== "undefined" ? getCountry() : "ZZ"
      const data = await fetch(`/api/musiva/top-playlists?country=${country}`).then(r => r.json())
      const results: any[] = Array.isArray(data) ? data : []
      // Fallback: if top-playlists returns empty, search for popular ones
      if (results.length === 0) {
        const fallback = await fetch("/api/musiva/search?q=top+hits&filter=playlists&limit=12&offset=0").then(r => r.json())
        const fb = (fallback.results || []).filter((p: any) => p.browseId).slice(0, 10)
        setTopPlaylists(fb)
      } else {
        setTopPlaylists(results.slice(0, 12))
      }
    } catch { setTopPlaylists([]) }
    setTopPLLoading(false)
  }, []) // eslint-disable-line

  const loadTrending = useCallback(async (country?: string, limit?: number, source?: string) => {
    setTrendingLoading(true)
    const c = country ?? trendingCountry
    const l = limit   ?? trendingLimit
    const s = source  ?? trendingSource
    try {
      // v8: always pass country (ZZ = global), no multi=1
      const url = `/api/musiva/trending?country=${c || "ZZ"}&limit=${l}&sources=${s}`
      const data = await fetch(url).then(r => r.json())
      setTrending(data.trending || [])
    } catch { setTrending([]) }
    setTrendingLoading(false)
  }, [trendingCountry, trendingLimit, trendingSource])

  const loadMoreTrending = useCallback(async () => {
    const newLimit = Math.min(trendingLimit + 10, 100)  // v8 supports up to 100
    if (newLimit === trendingLimit) return
    setTrendingLoadingMore(true)
    try {
      const url = `/api/musiva/trending?country=${trendingCountry || "ZZ"}&limit=${newLimit}&sources=${trendingSource}`
      const data = await fetch(url).then(r => r.json())
      setTrending(data.trending || [])
      setTrendingLimit(newLimit)
    } catch {}
    setTrendingLoadingMore(false)
  }, [trendingCountry, trendingLimit, trendingSource])



  const loadCharts = useCallback(async (country: string, source?: string) => {
    setChartsLoading(true)
    const s = source ?? chartsSource
    try {
      const data = await fetch(
        `/api/musiva/charts?country=${country || "ZZ"}&sources=${s}`
      ).then(r => r.json())
      setCharts({
        songs:    data.songs    || [],
        videos:   data.videos   || [],
        artists:  data.artists  || [],
        trending: data.trending || [],
      })
    } catch { setCharts({ songs: [], videos: [], artists: [], trending: [] }) }
    setChartsLoading(false)
  }, [chartsSource])

  useEffect(() => { loadHome(); loadRecentlyPlayed(); loadTopPlaylists() }, []) // eslint-disable-line
  useEffect(() => { if (activeView === "home" && aiEnabled) loadAIRecommendations() }, [activeView, aiEnabled]) // eslint-disable-line
  useEffect(() => { if (activeView === "home" && aiEnabled) { loadAIRecommendations(); loadAICollabSignals() } }, [activeView, aiEnabled]) // eslint-disable-line
  useEffect(() => { if (activeView === "trending") loadTrending() }, [activeView, trendingCountry, trendingSource]) // eslint-disable-line
  useEffect(() => { if (activeView === "charts") loadCharts(selectedRegion) }, [activeView, selectedRegion, chartsSource]) // eslint-disable-line

  // ── Share-to-Play: handle ?share_url= (PWA Web Share Target) ────────────
  useEffect(() => {
    // ── Parse any YouTube URL → { videoId, startSeconds } ─────────────────
    // Handles: watch?v=, youtu.be/, shorts/, embed/, live/, music.youtube.com
    function parseYouTubeUrl(raw: string): { videoId: string; startSeconds: number } | null {
      let url: URL
      try { url = new URL(raw) } catch { return null }

      const host = url.hostname.replace(/^www\./, "")
      const isYT = host === "youtube.com" || host === "youtu.be" ||
                   host === "music.youtube.com" || host === "m.youtube.com" ||
                   host === "gaming.youtube.com"
      if (!isYT) return null

      let videoId = ""

      if (host === "youtu.be") {
        // https://youtu.be/ID?t=90
        videoId = url.pathname.slice(1).split("/")[0]
      } else {
        const path = url.pathname
        if (path.startsWith("/shorts/")) {
          // https://youtube.com/shorts/ID
          videoId = path.split("/shorts/")[1]?.split("/")[0] || ""
        } else if (path.startsWith("/embed/")) {
          videoId = path.split("/embed/")[1]?.split("/")[0] || ""
        } else if (path.startsWith("/v/")) {
          videoId = path.split("/v/")[1]?.split("/")[0] || ""
        } else if (path.startsWith("/live/")) {
          videoId = path.split("/live/")[1]?.split("/")[0] || ""
        } else {
          // /watch?v=ID  or  music.youtube.com/watch?v=ID
          videoId = url.searchParams.get("v") || ""
        }
      }

      // Clean the videoId (remove any trailing garbage)
      videoId = videoId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 11)
      if (!videoId) return null

      // ── Parse timestamp ──────────────────────────────────────────────────
      // YouTube uses t= in query string, sometimes #t= in hash
      // Formats: t=90  t=1m30s  t=1h2m3s  t=30s
      const rawT = url.searchParams.get("t") ||
                   url.searchParams.get("start") ||
                   url.hash.replace(/^#t=/, "") || ""

      let startSeconds = 0
      if (rawT) {
        if (/^\d+$/.test(rawT)) {
          // Pure number of seconds: t=90
          startSeconds = parseInt(rawT, 10)
        } else {
          // Human format: t=1h2m3s  or  t=1m30s  or  t=30s
          const h = rawT.match(/(\d+)h/)?.[1] || "0"
          const m = rawT.match(/(\d+)m/)?.[1] || "0"
          const s = rawT.match(/(\d+)s/)?.[1] || "0"
          startSeconds = parseInt(h) * 3600 + parseInt(m) * 60 + parseInt(s)
        }
      }

      return { videoId, startSeconds }
    }

    // ── Read share_url from query string (set by PWA share_target) ────────
    const sp       = new URLSearchParams(window.location.search)
    // The share sheet sends the YouTube page URL in share_url,
    // sometimes also in share_text (Chrome Android sends both).
    const shareRaw = sp.get("share_url") || sp.get("share_text") || ""

    if (!shareRaw) return

    // Strip the share param from the browser URL immediately so
    // a page refresh doesn't re-trigger the handler
    const cleanUrl = window.location.pathname
    window.history.replaceState({}, "", cleanUrl)

    const parsed = parseYouTubeUrl(shareRaw)
    if (!parsed) return  // not a YouTube URL, ignore silently

    const { videoId, startSeconds } = parsed

    // ── Fetch metadata and play ───────────────────────────────────────────
    setShareResolving("loading")
    setShareTitle("")

    ;(async () => {
      try {
        // MUSIVA /song/<videoId> returns full track metadata
        const res  = await fetch(`/api/musiva/song?video_id=${encodeURIComponent(videoId)}`)
        const data = await res.json()

        if (data.error || !data.title) throw new Error("No metadata")

        // Normalise to Song shape (same as convertToSong)
        const artistStr: string =
          typeof data.artist === "string" ? data.artist :
          data.artist?.name ?? 
          (Array.isArray(data.artists)
            ? data.artists.map((a: any) => typeof a === "string" ? a : a?.name || "").filter(Boolean).join(", ")
            : "Unknown")

        const thumb: string =
          Array.isArray(data.thumbnails) && data.thumbnails.length
            ? [...data.thumbnails].sort((a: any, b: any) => (b?.width || 0) - (a?.width || 0))[0]?.url || ""
            : data.thumbnail || ""

        const song = {
          id:        videoId,
          videoId:   videoId,
          title:     data.title     || "Unknown",
          artist:    artistStr      || "Unknown",
          thumbnail: thumb,
          album:     typeof data.album === "string" ? data.album : data.album?.name || "",
          duration:  data.duration  || "",
          type:      "musiva" as const,
        }

        setShareTitle(song.title)
        setShareResolving("idle")

        // Play from timestamp — playSong(song, isManual, startTime)
        playSong(song, true, startSeconds)

        // Navigate to player
        router.push(
          `/player?id=${encodeURIComponent(videoId)}` +
          `&title=${encodeURIComponent(song.title)}` +
          `&artist=${encodeURIComponent(song.artist)}` +
          `&thumbnail=${encodeURIComponent(song.thumbnail)}` +
          `&type=musiva` +
          `&videoId=${encodeURIComponent(videoId)}` +
          (startSeconds > 0 ? `&t=${startSeconds}` : "")
        )

      } catch {
        // Metadata fetch failed — still play by videoId directly
        // (YT iframe will load the video, upnext will fill in title)
        setShareResolving("idle")
        const fallback = {
          id: videoId, videoId, title: "Loading…",
          artist: "", thumbnail: "", type: "musiva" as const,
        }
        playSong(fallback, true, startSeconds)
        router.push(
          `/player?id=${encodeURIComponent(videoId)}` +
          `&title=${encodeURIComponent("")}` +
          `&artist=${encodeURIComponent("")}` +
          `&thumbnail=&type=musiva` +
          `&videoId=${encodeURIComponent(videoId)}` +
          (startSeconds > 0 ? `&t=${startSeconds}` : "")
        )
      }
    })()
  }, []) // eslint-disable-line

  // ── Paste & Play: watch clipboard for YouTube URLs ────────────────────
  useEffect(() => {
    // Re-used from the share handler — extract videoId + timestamp from any YT URL
    function parseYT(raw: string): { videoId: string; startSeconds: number } | null {
      let url: URL
      try { url = new URL(raw.trim()) } catch { return null }
      const host = url.hostname.replace(/^www\./, "")
      const isYT = ["youtube.com","youtu.be","music.youtube.com",
                    "m.youtube.com","gaming.youtube.com"].includes(host)
      if (!isYT) return null
      let videoId = ""
      if (host === "youtu.be") {
        videoId = url.pathname.slice(1).split("/")[0]
      } else {
        const p = url.pathname
        if      (p.startsWith("/shorts/")) videoId = p.split("/shorts/")[1]?.split("/")[0] || ""
        else if (p.startsWith("/embed/"))  videoId = p.split("/embed/")[1]?.split("/")[0]  || ""
        else if (p.startsWith("/v/"))      videoId = p.split("/v/")[1]?.split("/")[0]      || ""
        else if (p.startsWith("/live/"))   videoId = p.split("/live/")[1]?.split("/")[0]   || ""
        else videoId = url.searchParams.get("v") || ""
      }
      videoId = videoId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 11)
      if (!videoId) return null
      const rawT = url.searchParams.get("t") || url.searchParams.get("start") ||
                   url.hash.replace(/^#t=/, "") || ""
      let startSeconds = 0
      if (rawT) {
        if (/^\d+$/.test(rawT)) {
          startSeconds = parseInt(rawT, 10)
        } else {
          const h = rawT.match(/(\d+)h/)?.[1] || "0"
          const m = rawT.match(/(\d+)m/)?.[1] || "0"
          const s = rawT.match(/(\d+)s/)?.[1] || "0"
          startSeconds = parseInt(h)*3600 + parseInt(m)*60 + parseInt(s)
        }
      }
      return { videoId, startSeconds }
    }

    // Format seconds → "1:30" for the button label
    function fmtTime(s: number): string {
      if (!s) return ""
      const h = Math.floor(s / 3600)
      const m = Math.floor((s % 3600) / 60)
      const sec = s % 60
      if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`
      return `${m}:${String(sec).padStart(2,"0")}`
    }

    async function checkClipboard() {
      try {
        if (!navigator.clipboard?.readText) return
        const text = await navigator.clipboard.readText()
        const parsed = parseYT(text)
        if (parsed) {
          const ts = parsed.startSeconds
          const label = ts > 0 ? `Play from ${fmtTime(ts)}` : "Play in Musicanaz"
          setPasteUrl(text)
          setPasteLabel(label)
        } else {
          setPasteUrl(null)
        }
      } catch {
        // Permission denied or clipboard empty — hide button silently
        setPasteUrl(null)
      }
    }

    // Check when user switches back to the tab / app
    const onVisible = () => { if (document.visibilityState === "visible") checkClipboard() }
    const onFocus   = () => checkClipboard()

    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onFocus)
    // Also check once on mount (handles page reload after copying)
    checkClipboard()

    return () => {
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onFocus)
    }
  }, []) // eslint-disable-line

  // ── Paste & Play: execute when user taps the button ───────────────────
  const handlePastePlay = async () => {
    if (!pasteUrl || pasteLoading) return
    setPasteLoading(true)

    // Re-parse to get videoId + startSeconds cleanly
    let url: URL; try { url = new URL(pasteUrl.trim()) } catch { setPasteLoading(false); return }
    const host = url.hostname.replace(/^www\./, "")
    let videoId = ""
    if (host === "youtu.be") {
      videoId = url.pathname.slice(1).split("/")[0]
    } else {
      const p = url.pathname
      if      (p.startsWith("/shorts/")) videoId = p.split("/shorts/")[1]?.split("/")[0] || ""
      else if (p.startsWith("/embed/"))  videoId = p.split("/embed/")[1]?.split("/")[0]  || ""
      else if (p.startsWith("/v/"))      videoId = p.split("/v/")[1]?.split("/")[0]      || ""
      else if (p.startsWith("/live/"))   videoId = p.split("/live/")[1]?.split("/")[0]   || ""
      else videoId = url.searchParams.get("v") || ""
    }
    videoId = videoId.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 11)
    if (!videoId) { setPasteLoading(false); return }

    const rawT = url.searchParams.get("t") || url.searchParams.get("start") ||
                 url.hash.replace(/^#t=/, "") || ""
    let startSeconds = 0
    if (rawT) {
      if (/^\d+$/.test(rawT)) startSeconds = parseInt(rawT, 10)
      else {
        const h = rawT.match(/(\d+)h/)?.[1] || "0"
        const m = rawT.match(/(\d+)m/)?.[1] || "0"
        const s = rawT.match(/(\d+)s/)?.[1] || "0"
        startSeconds = parseInt(h)*3600 + parseInt(m)*60 + parseInt(s)
      }
    }

    try {
      // Fetch metadata
      const res  = await fetch(`/api/musiva/song?video_id=${encodeURIComponent(videoId)}`)
      const data = await res.json()

      const artistStr: string =
        typeof data.artist === "string" ? data.artist :
        data.artist?.name ??
        (Array.isArray(data.artists)
          ? data.artists.map((a: any) => typeof a === "string" ? a : a?.name || "").filter(Boolean).join(", ")
          : "Unknown")

      const thumb: string =
        Array.isArray(data.thumbnails) && data.thumbnails.length
          ? [...data.thumbnails].sort((a: any, b: any) => (b?.width||0)-(a?.width||0))[0]?.url || ""
          : data.thumbnail || ""

      const song = {
        id: videoId, videoId,
        title:     data.title  || "Unknown",
        artist:    artistStr   || "Unknown",
        thumbnail: thumb,
        album:     typeof data.album === "string" ? data.album : data.album?.name || "",
        duration:  data.duration || "",
        type:      "musiva" as const,
      }

      playSong(song, true, startSeconds)
      setPasteUrl(null)
      router.push(
        `/player?id=${encodeURIComponent(videoId)}` +
        `&title=${encodeURIComponent(song.title)}` +
        `&artist=${encodeURIComponent(song.artist)}` +
        `&thumbnail=${encodeURIComponent(song.thumbnail)}` +
        `&type=musiva&videoId=${encodeURIComponent(videoId)}` +
        (startSeconds > 0 ? `&t=${startSeconds}` : "")
      )
    } catch {
      // Metadata failed — play by videoId directly
      playSong({ id: videoId, videoId, title: "Loading…", artist: "", thumbnail: "", type: "musiva" as const }, true, startSeconds)
      setPasteUrl(null)
      router.push(`/player?id=${encodeURIComponent(videoId)}&title=&artist=&thumbnail=&type=musiva&videoId=${encodeURIComponent(videoId)}${startSeconds > 0 ? `&t=${startSeconds}` : ""}`)
    } finally {
      setPasteLoading(false)
    }
  }

  // Suggestions
  const fetchSuggestions = useCallback(async (q: string) => {
    if (!q.trim()) { setSuggestions([]); setShowSuggestions(false); return }
    setSuggestLoading(true)
    try {
      const data = await fetch(`/api/musiva/suggestions?q=${encodeURIComponent(q)}`).then(r => r.json())
      const list = (data.suggestions || (Array.isArray(data) ? data : [])).slice(0, 8)
      setSuggestions(list)
      setShowSuggestions(list.length > 0)
    } catch { setSuggestions([]); setShowSuggestions(false) }
    setSuggestLoading(false)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setSearchQuery(val)
    if (val) setPasteUrl(null)  // dismiss paste button while typing
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!val.trim()) { setSuggestions([]); setShowSuggestions(false); return }
    debounceRef.current = setTimeout(() => fetchSuggestions(val), 280)
  }

  // Search executor — with per-filter limit
  const executeSearch = useCallback(async (query: string, filter: FilterType, offset = 0, append = false) => {
    const LIMIT = 20
    const LOAD_MORE_CHUNK = 10
    if (!query.trim()) return
    setShowSuggestions(false)
    setSearchQuery(query)
    if (!append) setIsSearching(true)
    else setIsLoadingMore(true)
    if (!append && !resultsPushed.current) {
      window.history.pushState({ view: "results" }, "", "#results")
      resultsPushed.current = true
    }
    setActiveView("results")
    searchedQuery.current = query
    try {
      const fetchLimit = append ? LOAD_MORE_CHUNK : LIMIT
      // ── AI-powered search (songs only, first page) ──
      let newItems: any[] = []
      let aiUsed = false
      if (aiEnabled && filter === "songs" && !append) {
        setAiSearchLoading(true)
        try {
          const aiData = await aiPersonalizedSearch(query, fetchLimit)
          if (aiData.results?.length) {
            newItems  = aiData.results.map((r: any) => ({
              videoId:    r.song_id || r.videoId,
              id:         r.song_id || r.videoId,
              title:      r.title,
              artists:    [{ name: r.artist }],
              album:      { name: r.album || "" },
              thumbnails: r.thumbnail ? [{ url: r.thumbnail, width: 226 }] : [],
              duration:   r.duration || "",
              _aiScore:   r.relevance_score,
              _source:    r.source || "personal",
            }))
            aiUsed = true
            setAiSearchBadge(aiData.personalized || false)
          }
        } catch {}
        setAiSearchLoading(false)
      }
      if (!aiUsed) {
        setAiSearchBadge(false)
        const url = `/api/musiva/search?q=${encodeURIComponent(query)}&filter=${filter}&limit=${fetchLimit}&offset=${offset}`
        const data = await fetch(url).then(r => r.json())
        newItems = data.results || data || []
      }
      if (false) { const data = { hasMore: false }; void data } // type guard
      if (append) {
        setSearchResults(prev => ({ ...prev, [filter]: [...prev[filter], ...newItems] }))
      } else {
        setSearchResults(prev => ({ ...prev, [filter]: newItems }))
      }
      setHasMore(prev => ({ ...prev, [filter]: !aiUsed && (newItems.length >= fetchLimit) }))
    } catch {
      if (!append) setSearchResults(prev => ({ ...prev, [filter]: [] }))
    }
    setIsSearching(false)
    setIsLoadingMore(false)
  }, [])

  const handleLoadMore = async () => {
    const currentOffset = searchResults[activeFilter].length
    await executeSearch(searchedQuery.current, activeFilter, currentOffset, true)
  }

  const handleFilterChange = async (filter: FilterType) => {
    setActiveFilter(filter)
    if (!searchedQuery.current) return
    if (searchResults[filter].length > 0) return
    setIsSearching(true)
    try {
      const data = await fetch(
        `/api/musiva/search?q=${encodeURIComponent(searchedQuery.current)}&filter=${filter}&limit=20&offset=0`
      ).then(r => r.json())
      const results = data.results || data || []
      setSearchResults(prev => ({ ...prev, [filter]: results }))
      setHasMore(prev => ({ ...prev, [filter]: data.hasMore || results.length >= 20 }))
    } catch {}
    setIsSearching(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    // Reset limits for a new search
    setSearchResults({ songs: [], artists: [], albums: [], videos: [], playlists: [], podcasts: [] })
    setHasMore({ songs: false, artists: false, albums: false, videos: false, playlists: false, podcasts: false })
    executeSearch(searchQuery, activeFilter, 0, false)
  }

  const handleSuggestionClick = (s: string) => {
    setActiveFilter("songs")
    setSearchResults({ songs: [], artists: [], albums: [], videos: [], playlists: [], podcasts: [] })
    executeSearch(s, "songs", 0, false)
  }

  const clearSearch = () => {
    setSearchResults({ songs: [], artists: [], albums: [], videos: [], playlists: [], podcasts: [] })
    searchedQuery.current = ""
    resultsPushed.current = false
    window.history.back()
  }

  const handleNavChange = (v: View) => {
    resultsPushed.current = false
    setActiveView(v)
    if (v !== "results") { setSearchQuery(""); setSuggestions([]); setShowSuggestions(false) }
    if (v === "home") {
      window.history.pushState({ view: "home" }, "", window.location.pathname)
    } else {
      window.history.pushState({ view: v }, "", `#${v}`)
    }
  }

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (!suggestionsRef.current?.contains(e.target as Node) && !searchRef.current?.contains(e.target as Node))
        setShowSuggestions(false)
    }
    document.addEventListener("mousedown", h)
    return () => document.removeEventListener("mousedown", h)
  }, [])

  // Render search results grid for active filter
  const renderResults = () => {
    const items = searchResults[activeFilter]
    if (isSearching) return <CardGrid />
    if (!items.length) return (
      <div className="text-center py-20 text-muted-foreground">
        <Search className="w-10 h-10 mx-auto mb-3 opacity-20" />
        <p className="font-medium">No {activeFilter} found</p>
        <p className="text-sm mt-1 opacity-60">Try a different term</p>
      </div>
    )
    const showLoadMore = hasMore[activeFilter] && !isSearching

    if (activeFilter === "songs" || activeFilter === "videos") return (
      <>
        <div className={GRID}>
          {items.map((item, i) => <SongCard key={i} song={convertToSong(item)} onPlayComplete={loadRecentlyPlayed} />)}
        </div>
        {showLoadMore && <LoadMoreBtn loading={isLoadingMore} onClick={handleLoadMore} />}
      </>
    )
    if (activeFilter === "artists") return (
      <>
        <div className={GRID}>
          {items.map((item, i) => <ArtistCard key={i} item={item} onClick={() => item.browseId && router.push(`/artist?id=${item.browseId}`)} />)}
        </div>
        {showLoadMore && <LoadMoreBtn loading={isLoadingMore} onClick={handleLoadMore} />}
      </>
    )
    if (activeFilter === "albums") return (
      <>
        <div className={GRID}>
          {items.map((item, i) => <AlbumCard key={i} item={item} onClick={() => item.browseId && router.push(`/album?id=${item.browseId}`)} />)}
        </div>
        {showLoadMore && <LoadMoreBtn loading={isLoadingMore} onClick={handleLoadMore} />}
      </>
    )
    if (activeFilter === "playlists") return (
      <>
        <div className={GRID}>
          {items.map((item, i) => <PlaylistCard key={i} item={item} onClick={() => item.browseId && router.push(`/playlist?id=${item.browseId}`)} />)}
        </div>
        {showLoadMore && <LoadMoreBtn loading={isLoadingMore} onClick={handleLoadMore} />}
      </>
    )
    if (activeFilter === "podcasts") return (
      <>
        <div className={GRID}>
          {items.map((item, i) => <PodcastCard key={i} item={item} onClick={() => { if (item.browseId) router.push(`/podcast?id=${item.browseId}`) }} />)}
        </div>
        {showLoadMore && <LoadMoreBtn loading={isLoadingMore} onClick={handleLoadMore} />}
      </>
    )
    return null
  }

  const chartsItems: any[] = charts[chartsTab as keyof ChartsData] || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      <div className="container mx-auto px-3 sm:px-4 py-6 pb-36 max-w-7xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2.5">
            <ImageWithFallback src="https://raw.githubusercontent.com/wilooper/Asset/main/logo.png" alt="Musicanaz" className="w-10 h-10 rounded-xl object-contain flex-shrink-0" />
            <h1 className="text-xl font-bold tracking-tight">Musicanaz</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={() => router.push("/moods")} className="rounded-full px-3 gap-1">
              <Music2 className="w-4 h-4" /><span className="hidden sm:inline">Moods</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/library")} className="rounded-full px-3 gap-1">
              <Library className="w-4 h-4" /><span className="hidden sm:inline">Library</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => router.push("/history")} className="rounded-full px-3 gap-1">
              <Clock className="w-4 h-4" /><span className="hidden sm:inline">History</span>
            </Button>
            <Button variant="ghost" size="icon" onClick={() => router.push("/settings")} className="rounded-full w-9 h-9">
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* ── Search bar ── */}
        <div className="max-w-2xl mx-auto mb-6 relative z-30">
          {/* Country pill (non-global only) */}
          {activeView !== "results" && selectedRegion !== "ZZ" && (
            <div className="flex justify-center mb-3">
              <button
                onClick={() => router.push("/settings")}
                className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card/40 hover:bg-card/70 border border-border/30 px-3 py-1.5 rounded-full transition-colors"
              >
                <Globe className="w-3 h-3" />
                Content for: <span className="font-semibold text-foreground">{selectedRegion}</span>
                <Settings className="w-3 h-3 opacity-50" />
              </button>
            </div>
          )}

          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground pointer-events-none" />
              <Input
                ref={searchRef}
                type="text"
                placeholder="Songs, artists, albums, podcasts…"
                value={searchQuery}
                onChange={handleInputChange}
                onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                className="pl-11 pr-10 h-12 text-sm bg-card/60 backdrop-blur-md border-border/50 focus:border-primary/60 rounded-2xl"
                autoComplete="off"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                {suggestLoading && <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />}
                {/* AI toggle button */}
                <button
                  type="button"
                  title={aiEnabled ? "AI Search ON – click to disable" : "AI Search OFF – click to enable"}
                  onClick={() => { const next = !aiEnabled; setAiEnabled(next); setAISearchEnabled(next) }}
                  className={[
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all mr-0.5",
                    aiEnabled
                      ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30"
                      : "bg-card/60 text-muted-foreground border-border/40 hover:border-primary/40 hover:text-foreground",
                  ].join(" ")}
                >
                  {(aiEnabled && aiSearchLoading)
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />}
                  <span className="hidden sm:inline">AI</span>
                </button>
                <button
                  type="button"
                  title={aiEnabled ? "AI Search ON" : "AI Search OFF"}
                  onClick={() => { const n = !aiEnabled; setAiEnabled(n); setAISearchEnabled(n) }}
                  className={[
                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all mr-0.5",
                    aiEnabled
                      ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30"
                      : "bg-card/60 text-muted-foreground border-border/40 hover:border-primary/40",
                  ].join(" ")}
                >
                  {aiSearchLoading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />}
                  <span className="hidden sm:inline">AI</span>
                </button>
                {searchQuery && (
                  <button type="button" onClick={clearSearch} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </form>

          {/* ── Paste & Play banner ── */}
          {pasteUrl && !showSuggestions && (
            <div
              className="mt-2 flex items-center gap-2 px-3 py-2.5 rounded-2xl
                         bg-primary/10 border border-primary/25
                         animate-in slide-in-from-top-2 duration-200"
            >
              {/* Icon */}
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                <ClipboardPaste className="w-4 h-4 text-primary" />
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-primary leading-tight truncate">
                  {pasteLabel || "Play in Musicanaz"}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  YouTube link detected in clipboard
                </p>
              </div>

              {/* Play button */}
              <button
                onClick={handlePastePlay}
                disabled={pasteLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl
                           bg-primary text-primary-foreground text-xs font-semibold
                           hover:bg-primary/90 transition-colors disabled:opacity-60
                           flex-shrink-0"
              >
                {pasteLoading
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Play className="w-3.5 h-3.5" fill="currentColor" />
                }
                {pasteLoading ? "Loading…" : "Play"}
              </button>

              {/* Dismiss */}
              <button
                onClick={() => setPasteUrl(null)}
                className="w-7 h-7 rounded-full flex items-center justify-center
                           hover:bg-white/10 transition-colors text-muted-foreground
                           flex-shrink-0"
                title="Dismiss"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Suggestions */}
          {showSuggestions && suggestions.length > 0 && (
            <div ref={suggestionsRef} className="absolute top-full left-0 right-0 mt-1.5 bg-card/95 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden z-40">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestionClick(s)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-primary/8 transition-colors text-left"
                >
                  <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="flex-1 truncate">{s}</span>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Nav pills ── */}
        {activeView !== "results" && (
          <div className="flex items-center justify-center gap-2 mb-8 flex-wrap">
            {(["home", "trending", "charts", "radio"] as View[]).map(v => (
              <Button
                key={v}
                variant={activeView === v ? "default" : "ghost"}
                size="sm"
                className="rounded-full px-5 gap-1.5 capitalize"
                onClick={() => handleNavChange(v)}
              >
                {v === "home"     && <Home      className="w-3.5 h-3.5" />}
                {v === "trending" && <TrendingUp className="w-3.5 h-3.5" />}
                {v === "charts"   && <BarChart3  className="w-3.5 h-3.5" />}
                {v === "radio"    && <Radio      className="w-3.5 h-3.5" />}
                {v}
              </Button>
            ))}
          </div>
        )}

        {/* ══ RESULTS ══ */}
        {activeView === "results" && (
          <section>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={clearSearch} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRight className="w-4 h-4 rotate-180" />Back
              </button>
              <h2 className="text-base font-bold truncate">"{searchedQuery.current}"</h2>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-hide">
              {FILTER_TABS.map(({ key, label, icon }) => (
                <button
                  key={key}
                  onClick={() => handleFilterChange(key)}
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border flex-shrink-0",
                    activeFilter === key
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card/40 text-muted-foreground border-border/40 hover:bg-card/70 hover:text-foreground",
                  ].join(" ")}
                >
                  {icon}{label}
                  {searchResults[key].length > 0 && (
                    <span className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full ${activeFilter === key ? "bg-white/20" : "bg-muted"}`}>
                      {searchResults[key].length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* AI personalised badge */}
            {aiEnabled && aiSearchBadge && activeFilter === "songs" && (
              <div className="flex items-center gap-1.5 mb-3 text-xs text-primary">
                <Sparkles className="w-3 h-3" />
                <span className="font-medium">Personalised results</span>
                <span className="text-muted-foreground">· sorted by your taste</span>
              </div>
            )}
            {aiEnabled && !aiSearchBadge && activeFilter === "songs" && searchResults["songs"].length > 0 && (
              <div className="flex items-center gap-1.5 mb-3 text-xs text-muted-foreground">
                <Sparkles className="w-3 h-3" />
                <span>AI Search active · build history to personalise</span>
              </div>
            )}
            {aiEnabled && aiSearchBadge && activeFilter === "songs" && (
              <div className="flex items-center gap-1.5 mb-3 text-xs text-primary">
                <Sparkles className="w-3 h-3" />
                <span className="font-medium">Personalised for you</span>
                <span className="text-muted-foreground ml-1">· ranked by your taste</span>
              </div>
            )}
            {renderResults()}
          </section>
        )}

        {/* ══ HOME ══ */}
        {activeView === "home" && (
          <div>
            {/* ── AI Recommendations (For You) ── */}
            {aiEnabled && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-bold">For You</h2>
                  {aiRecos.length > 0 && (
                    <span className="text-xs text-muted-foreground px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 ml-1">
                      AI · personalised
                    </span>
                  )}
                  <button
                    onClick={loadAIRecommendations}
                    className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >Refresh</button>
                </div>
                {aiRecosLoading ? (
                  <CardGrid n={6} />
                ) : aiRecos.length > 0 ? (
                  <div className={GRID}>
                    {aiRecos.slice(0, 12).map((song, i) => (
                      <SongCard key={i} song={song} onPlayComplete={loadRecentlyPlayed} />
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/30 border border-border/20 text-sm text-muted-foreground">
                    <Zap className="w-4 h-4 text-primary/50 flex-shrink-0" />
                    <span>Play a few songs to unlock personalised recommendations</span>
                  </div>
                )}

                {/* Collab signals strip */}
                {aiCollabSignals.length > 0 && (
                  <div className="mt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Zap className="w-3.5 h-3.5 text-blue-400" />
                      <h3 className="text-sm font-semibold">Discovered by listeners like you</h3>
                      <span className="text-[10px] text-blue-400/80 bg-blue-400/10 border border-blue-400/20 px-2 py-0.5 rounded-full">collab</span>
                    </div>
                    <div className={GRID}>
                      {aiCollabSignals.slice(0, 6).map((song, i) => (
                        <SongCard key={i} song={song} onPlayComplete={loadRecentlyPlayed} />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── AI Analysis + Recommendations ── */}
            {aiEnabled && (
              <section className="mb-8">
                <div className="rounded-2xl bg-card/40 border border-border/30 p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-primary" />
                    <h2 className="text-base font-bold">AI Analysis</h2>
                    {localStats && (
                      <span className="ml-auto text-xs text-muted-foreground font-mono">
                        {localStats.total_plays} plays · {localStats.liked} liked · {localStats.skipped} skipped
                      </span>
                    )}
                  </div>
                  {!aiAnalysis && !aiAnalyzing && (
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <Zap className="w-8 h-8 text-primary/30" />
                      <p className="text-sm font-medium">No analysis yet</p>
                      <p className="text-xs text-muted-foreground max-w-xs">Play a few songs then run the AI. It classifies your taste via MusicBrainz and finds users who share your vibe.</p>
                      {aiAnalysisError && <p className="text-xs text-destructive">{aiAnalysisError}</p>}
                      <button onClick={handleRunAnalysis} disabled={aiAnalyzing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">
                        {aiAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}
                        {aiAnalyzing ? "Analysing…" : "Run AI Analysis"}
                      </button>
                    </div>
                  )}
                  {aiAnalyzing && (
                    <div className="flex items-center gap-3 py-3 text-muted-foreground text-sm">
                      <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0"/>
                      <div>
                        <p className="font-medium">Analysing your taste…</p>
                        <p className="text-xs opacity-70 mt-0.5">Classifying songs via MusicBrainz. Up to 60 s on first run.</p>
                      </div>
                    </div>
                  )}
                  {aiAnalysis && !aiAnalyzing && (
                    <div className="flex flex-col gap-3">
                      <p className="text-sm text-muted-foreground leading-relaxed">{aiAnalysis.taste_summary}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(aiAnalysis.liked_types || []).map((t, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/25 font-medium">♥ {t}</span>
                        ))}
                        {(aiAnalysis.disliked_types || []).map((t, i) => (
                          <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-destructive/10 text-destructive/70 border border-destructive/20">✕ {t}</span>
                        ))}
                      </div>
                      {(aiAnalysis.similar_users || []).length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Zap className="w-3.5 h-3.5 text-blue-400"/>
                          <span><span className="text-blue-400 font-semibold">{aiAnalysis.similar_users.length}</span> listeners share your taste</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-xs text-muted-foreground/60 flex-1">
                          {aiAnalysis.generated_at ? `Analysed ${Math.round((Date.now()-aiAnalysis.generated_at)/3_600_000)}h ago` : ""}
                        </span>
                        <button onClick={handleRunAnalysis} disabled={aiAnalyzing}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border/40 px-2.5 py-1 rounded-full transition-colors">
                          <Sparkles className="w-3 h-3"/>Re-analyse
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-primary"/>
                  <h3 className="text-sm font-bold">Recommended for you</h3>
                  {aiRecos.length > 0 && <span className="text-[10px] text-primary/80 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full ml-1">AI · personalised</span>}
                  <button onClick={loadAIRecommendations} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">Refresh</button>
                </div>
                {aiRecosLoading ? <CardGrid n={6}/>
                  : aiRecos.length > 0 ? (
                    <div className={GRID}>
                      {aiRecos.slice(0,12).map((song,i) => <SongCard key={i} song={song} onPlayComplete={loadRecentlyPlayed}/>)}
                    </div>
                  ) : aiAnalysis ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/30 border border-border/20 text-sm text-muted-foreground">
                      <Zap className="w-4 h-4 text-primary/40 flex-shrink-0"/>
                      <span>No recommendations yet — re-run analysis or keep listening</span>
                    </div>
                  ) : null}
              </section>
            )}

            {/* Recently played */}
            {recentlyPlayed.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="w-4 h-4 text-primary" />
                  <h2 className="text-base font-bold">Recently Played</h2>
                </div>
                <div className={GRID}>
                  {recentlyPlayed.slice(0, 6).map((song, i) => (
                    <SongCard key={i} song={song} onPlayComplete={loadRecentlyPlayed} />
                  ))}
                </div>
              </section>
            )}

            {/* Home shelves */}
            {homeLoading ? (
              <><ShelfSkeleton /><ShelfSkeleton /></>
            ) : homeShelves.length > 0 ? (
              homeShelves.map((shelf, si) => (
                <section key={si} className="mb-8">
                  <h2 className="text-base font-bold mb-4">{shelf.title}</h2>
                  <div className={GRID}>
                    {shelf.contents.map((track: any, idx: number) => (
                      <SongCard key={idx} song={convertToSong(track)} onPlayComplete={loadRecentlyPlayed} />
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <Music className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">Home feed unavailable</p>
                <p className="text-sm mt-1 opacity-60">Search for your favourite songs above</p>
              </div>
            )}

            {/* ── Top Playlists ── */}
            <section className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <ListMusic className="w-4 h-4 text-primary" />
                <h2 className="text-base font-bold">Top Playlists</h2>
              </div>
              {topPLLoading ? (
                <CardGrid n={6} />
              ) : topPlaylists.length > 0 ? (
                <div className={GRID}>
                  {topPlaylists.map((pl, i) => (
                    <PlaylistCard
                      key={i}
                      item={pl}
                      onClick={() => pl.browseId && router.push(`/playlist?id=${pl.browseId}`)}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-10 text-muted-foreground opacity-60">
                  <ListMusic className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Could not load playlists</p>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ══ TRENDING ══ */}
        {activeView === "trending" && (
          <section>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-xl font-bold">Trending Now</h2>
            </div>

            {/* Source pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
              {([
                ["all",    "🎵 All"],
                ["ytm",    "▶ YouTube"],
                ["apple",  " Apple"],
                ["deezer", "🎧 Deezer"],
                ["lastfm", "📻 Last.fm"],
              ] as const).map(([src, label]) => (
                <button
                  key={src}
                  onClick={() => {
                    setTrendingSource(src)
                    savePreferences({ trendingSource: src })
                    setTrending([])
                  }}
                  className={[
                    "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all flex-shrink-0",
                    trendingSource === src
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card/40 text-muted-foreground border-border/40 hover:bg-card/70 hover:text-foreground",
                  ].join(" ")}
                >{label}</button>
              ))}
            </div>

            {/* Country pills */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-5 scrollbar-hide">
              {TRENDING_COUNTRIES.map(({ code, flag, name }) => (
                <button
                  key={code}
                  onClick={() => {
                    setTrendingCountry(code)
                    setTrendingLimit(20)
                    setTrending([])
                  }}
                  className={[
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-all flex-shrink-0",
                    trendingCountry === code
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card/40 text-muted-foreground border-border/40 hover:bg-card/70 hover:text-foreground",
                  ].join(" ")}
                >
                  <span>{flag}</span>
                  <span>{name}</span>
                </button>
              ))}
            </div>

            {trendingLoading ? (
              <CardGrid />
            ) : trending.length > 0 ? (
              <>
                <div className={GRID}>
                  {trending.map((t: any, i) => (
                    <TrendingCard key={`${t.videoId || t.title}-${i}`} item={t} rank={i + 1} />
                  ))}
                </div>
                {trendingLimit < 100 && (
                  <LoadMoreBtn loading={trendingLoadingMore} onClick={loadMoreTrending} />
                )}
              </>
            ) : (
              <div className="text-center py-16 text-muted-foreground">
                <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
                <p className="font-medium">No trending data for this region</p>
                <p className="text-sm opacity-60 mt-1">Try a different country</p>
              </div>
            )}
          </section>
        )}

        {/* ══ RADIO ══ */}
        {activeView === "radio" && <RadioView />}

        {/* ══ CHARTS ══ */}
        {activeView === "charts" && (
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <h2 className="text-xl font-bold">Top Charts</h2>
              {/* Region selector — scrollable on small screens */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {[["ZZ","🌍 Global"],["US","🇺🇸 US"],["IN","🇮🇳 India"],["GB","🇬🇧 UK"],["AU","🇦🇺 AU"],["JP","🇯🇵 Japan"],["KR","🇰🇷 Korea"],["BR","🇧🇷 Brazil"]].map(([code, label]) => (
                  <Button
                    key={code}
                    variant={selectedRegion === code ? "default" : "outline"}
                    size="sm"
                    className="rounded-full text-xs flex-shrink-0 px-3 h-7"
                    onClick={() => { setSelectedRegion(code); savePreferences({ country: code }) }}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>

              {/* Source pills */}
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                {([
                  ["all",    "🎵 All"],
                  ["ytm",    "▶ YouTube"],
                  ["apple",  " Apple"],
                  ["deezer", "🎧 Deezer"],
                  ["lastfm", "📻 Last.fm"],
                ] as const).map(([src, label]) => (
                  <button
                    key={src}
                    onClick={() => {
                      setChartsSource(src)
                      savePreferences({ chartsSource: src })
                    }}
                    className={[
                      "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border transition-all flex-shrink-0",
                      chartsSource === src
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card/40 text-muted-foreground border-border/40 hover:bg-card/70 hover:text-foreground",
                    ].join(" ")}
                  >{label}</button>
                ))}
              </div>

            {chartsLoading ? (
              <><ShelfSkeleton /></>
            ) : (
              <>
                <ChartsArtistsRow artists={charts.artists} />
                <div className="flex gap-2 mb-5">
                  {(["songs","videos","trending"] as const).map(tab => (
                    <Button
                      key={tab}
                      variant={chartsTab === tab ? "default" : "outline"}
                      size="sm"
                      className="rounded-full capitalize text-xs"
                      onClick={() => setChartsTab(tab)}
                    >
                      {tab}
                    </Button>
                  ))}
                </div>
                {chartsItems.length > 0 ? (
                  <div className={GRID}>
                    {chartsItems.map((t: any, i) => <SongCard key={i} song={convertToSong(t)} onPlayComplete={loadRecentlyPlayed} />)}
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-medium">No {chartsTab} data</p>
                  </div>
                )}
              </>
            )}
          </section>
        )}

      </div>
      {/* ── Share-to-Play loading overlay ── */}
      {shareResolving === "loading" && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50"
             style={{ animation: "fadeInUp 0.25s ease" }}>
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl
                          bg-card/90 border border-border/40 shadow-xl
                          backdrop-blur-md min-w-[220px] max-w-[90vw]">
            <Loader2 className="w-4 h-4 animate-spin text-primary flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">Opening in Musicanaz…</p>
              <p className="text-xs text-muted-foreground">Fetching song info</p>
            </div>
          </div>
        </div>
      )}
      <PWAInstallBanner />
    </div>
  )
}
