"use client"

import type React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import {
  Search, Music, Clock, Library, TrendingUp,
  BarChart3, Home, X, Loader2, ChevronRight,
  Mic2, Disc3, ListMusic, Radio, Video, Music2,
  Settings, Globe, Play,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import SongCard from "@/components/song-card"
import ImageWithFallback from "@/components/image-with-fallback"
import { getRecentlyPlayed, getCountry, savePreferences } from "@/lib/storage"
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
  return {
    id:        track.videoId || track.id || "",
    title:     track.title  || "Unknown",
    artist:    toArtistStr(track.artists),
    thumbnail: getBestThumbnail(track.thumbnails, track.thumbnail),
    type:      "musiva",
    videoId:   track.videoId || "",
    album:     typeof track.album === "string" ? track.album : track.album?.name || "",
    duration:  track.duration || "",
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
  const song = convertToSong(item)
  return (
    <div
      onClick={() => playSong(song)}
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
          <div className="opacity-0 group-hover:opacity-100 w-9 h-9 rounded-full bg-white/90 flex items-center justify-center transition-all scale-90 group-hover:scale-100">
            <Play className="w-4 h-4 text-black fill-black ml-0.5" />
          </div>
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
  const [charts,          setCharts]          = useState<ChartsData>({ songs: [], videos: [], artists: [], trending: [] })
  const [chartsLoading,   setChartsLoading]   = useState(false)
  const [selectedRegion,  setSelectedRegion]  = useState("ZZ")
  const [chartsTab,       setChartsTab]       = useState<"songs" | "videos" | "trending">("songs")
  const [recentlyPlayed,  setRecentlyPlayed]  = useState<Song[]>([])
  const [activeView,      setActiveView]      = useState<View>("home")

  const searchRef      = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)
  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searchedQuery  = useRef("")

  // Load country pref on mount
  useEffect(() => { setSelectedRegion(getCountry()) }, [])

  // Loaders
  const loadRecentlyPlayed = useCallback(() => setRecentlyPlayed(getRecentlyPlayed()), [])

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

  const loadTrending = useCallback(async (country?: string, limit?: number) => {
    setTrendingLoading(true)
    const c = country ?? trendingCountry
    const l = limit   ?? trendingLimit
    try {
      let url: string
      if (!c || c === "ZZ") {
        url = `/api/musiva/trending?multi=1&limit=${l}`
      } else {
        url = `/api/musiva/trending?country=${c}&limit=${l}`
      }
      const data = await fetch(url).then(r => r.json())
      setTrending(data.trending || [])
    } catch { setTrending([]) }
    setTrendingLoading(false)
  }, [trendingCountry, trendingLimit])

  const loadMoreTrending = useCallback(async () => {
    const newLimit = Math.min(trendingLimit + 10, 50)
    if (newLimit === trendingLimit) return
    setTrendingLoadingMore(true)
    try {
      const c = trendingCountry
      const url = (!c || c === "ZZ")
        ? `/api/musiva/trending?multi=1&limit=${newLimit}`
        : `/api/musiva/trending?country=${c}&limit=${newLimit}`
      const data = await fetch(url).then(r => r.json())
      setTrending(data.trending || [])
      setTrendingLimit(newLimit)
    } catch {}
    setTrendingLoadingMore(false)
  }, [trendingCountry, trendingLimit])



  const loadCharts = useCallback(async (country: string) => {
    setChartsLoading(true)
    try {
      const data = await fetch(`/api/musiva/charts?country=${country}`).then(r => r.json())
      setCharts({
        songs:    data.songs    || [],
        videos:   data.videos   || [],
        artists:  data.artists  || [],
        trending: data.trending || [],
      })
    } catch { setCharts({ songs: [], videos: [], artists: [], trending: [] }) }
    setChartsLoading(false)
  }, [])

  useEffect(() => { loadHome(); loadRecentlyPlayed(); loadTopPlaylists() }, []) // eslint-disable-line
  useEffect(() => { if (activeView === "trending") loadTrending() }, [activeView, trendingCountry]) // eslint-disable-line
  useEffect(() => { if (activeView === "charts") loadCharts(selectedRegion) }, [activeView, selectedRegion]) // eslint-disable-line

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
    setActiveView("results")
    searchedQuery.current = query
    try {
      const fetchLimit = append ? LOAD_MORE_CHUNK : LIMIT
      const url = `/api/musiva/search?q=${encodeURIComponent(query)}&filter=${filter}&limit=${fetchLimit}&offset=${offset}`
      const data = await fetch(url).then(r => r.json())
      const newItems: any[] = data.results || data || []
      if (append) {
        setSearchResults(prev => ({ ...prev, [filter]: [...prev[filter], ...newItems] }))
      } else {
        setSearchResults(prev => ({ ...prev, [filter]: newItems }))
      }
      setHasMore(prev => ({ ...prev, [filter]: data.hasMore || newItems.length >= fetchLimit }))
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
    setSearchQuery(""); setSuggestions([]); setShowSuggestions(false)
    setActiveView("home")
    setSearchResults({ songs: [], artists: [], albums: [], videos: [], playlists: [], podcasts: [] })
    searchedQuery.current = ""
    searchRef.current?.focus()
  }

  const handleNavChange = (v: View) => {
    setActiveView(v)
    if (v !== "results") { setSearchQuery(""); setSuggestions([]); setShowSuggestions(false) }
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
                {searchQuery && (
                  <button type="button" onClick={clearSearch} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </form>

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

            {renderResults()}
          </section>
        )}

        {/* ══ HOME ══ */}
        {activeView === "home" && (
          <div>
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
                {trendingLimit < 50 && (
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
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
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
      <PWAInstallBanner />
    </div>
  )
}
