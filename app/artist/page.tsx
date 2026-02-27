"use client"

import { useEffect, useState, Suspense, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import {
  ChevronLeft, Users, Music, Loader2, Play,
  ChevronRight, LayoutGrid, List, X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import SongCard from "@/components/song-card"
import ImageWithFallback from "@/components/image-with-fallback"
import { addToRecentlyPlayed } from "@/lib/storage"
import { useAudio } from "@/lib/audio-context"

/* ─── helpers ──────────────────────────────────────────── */
function getBestThumb(t: any): string {
  if (!t) return ""
  if (typeof t === "string") return t
  if (!Array.isArray(t) || !t.length) return ""
  const sorted = [...t].sort((a, b) => (b?.width || 0) - (a?.width || 0))
  const x = sorted[0]; return typeof x === "string" ? x : x?.url || ""
}
function toArtistStr(a: any): string {
  if (!a) return "Unknown"
  if (typeof a === "string") return a
  if (Array.isArray(a)) return a.map((x: any) => (typeof x === "string" ? x : x?.name || "")).join(", ")
  return "Unknown"
}
function toSong(item: any) {
  return {
    id:        item.videoId || "",
    title:     item.title  || "Unknown",
    artist:    toArtistStr(item.artists),
    thumbnail: item.thumbnail || getBestThumb(item.thumbnails || []),
    type:      "musiva" as const,
    videoId:   item.videoId || "",
    duration:  item.duration || "",
  }
}

/* ─── MediaCard ────────────────────────────────────────── */
function MediaCard({ item, label, onClick }: { item: any; label?: string; onClick: () => void }) {
  const thumb = item.thumbnail || getBestThumb(item.thumbnails || [])
  return (
    <div onClick={onClick} className="group cursor-pointer bg-card/30 rounded-2xl p-3 sm:p-4 hover:bg-card/50 hover:scale-[1.03] transition-all border border-border/20">
      <div className="aspect-square rounded-xl overflow-hidden mb-3 bg-muted relative">
        <ImageWithFallback
          src={thumb}
          alt={item.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
          fallback={<div className="w-full h-full flex items-center justify-center"><Music className="w-8 h-8 text-muted-foreground/30" /></div>}
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-lg">
            <Play className="w-5 h-5 text-primary-foreground ml-0.5" fill="currentColor" />
          </div>
        </div>
      </div>
      <p className="font-semibold text-sm truncate">{item.title}</p>
      <p className="text-xs text-muted-foreground truncate">{label || item.year || ""}</p>
    </div>
  )
}

/* ─── AllSongsPanel ────────────────────────────────────── */
function AllSongsPanel({
  artistId, artistName, onClose, onPlay,
}: {
  artistId: string; artistName: string
  onClose: () => void; onPlay: (s: any) => void
}) {
  const [songs,    setSongs]    = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [view,     setView]     = useState<"grid" | "list">("list")

  useEffect(() => {
    setLoading(true)
    fetch(`/api/musiva/artist-songs?id=${encodeURIComponent(artistId)}&limit=100`)
      .then(r => r.json())
      .then(d => { setSongs(d.songs || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [artistId])

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full flex-shrink-0">
          <X className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">All Songs by</p>
          <h2 className="font-bold truncate">{artistName}</h2>
        </div>
        {!loading && songs.length > 0 && (
          <span className="text-sm text-muted-foreground flex-shrink-0">{songs.length} songs</span>
        )}
        <button
          onClick={() => setView(v => v === "grid" ? "list" : "grid")}
          className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-card/60 transition-colors flex-shrink-0"
          title="Toggle view"
        >
          {view === "grid" ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
        </button>
      </div>

      <div className="container mx-auto px-4 py-6 pb-36 max-w-5xl">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
            <Loader2 className="w-10 h-10 animate-spin text-primary" />
            <p className="text-sm">Loading all songs…</p>
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Music className="w-12 h-12 opacity-20 mx-auto mb-4" />
            <p className="font-medium">No songs found</p>
            <p className="text-sm opacity-60 mt-1">Try searching for this artist directly</p>
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {songs.map((s, i) => (
              <SongCard key={`all-${s.videoId}-${i}`} song={toSong(s)} />
            ))}
          </div>
        ) : (
          /* List view — compact rows */
          <div className="space-y-px">
            {songs.map((s, i) => {
              const thumb = s.thumbnail || getBestThumb(s.thumbnails || [])
              return (
                <button
                  key={`all-${s.videoId}-${i}`}
                  onClick={() => onPlay(s)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-card/60 transition-colors group text-left"
                >
                  <span className="w-6 text-center text-xs text-muted-foreground/40 flex-shrink-0 tabular-nums group-hover:hidden">
                    {i + 1}
                  </span>
                  <Play className="w-4 h-4 text-primary flex-shrink-0 hidden group-hover:block" fill="currentColor" />
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <ImageWithFallback
                      src={thumb}
                      alt={s.title}
                      className="w-full h-full object-cover"
                      fallback={<div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-muted-foreground/30" /></div>}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{toArtistStr(s.artists)}</p>
                  </div>
                  {s.duration && <span className="text-xs text-muted-foreground flex-shrink-0 tabular-nums hidden sm:block">{s.duration}</span>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Main artist content ──────────────────────────────── */
function ArtistContent() {
  const router = useRouter()
  const params = useSearchParams()
  const id     = params.get("id")
  const { playSong } = useAudio()

  const [artist,        setArtist]        = useState<any>(null)
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState(false)
  const [showAllSongs,  setShowAllSongs]  = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    fetch(`/api/musiva/artist?id=${encodeURIComponent(id)}`)
      .then(r => r.json())
      .then(d => { setArtist(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [id])

  const playSongItem = useCallback((item: any) => {
    if (!item.videoId) return
    const song = toSong(item)
    playSong(song, true)
    addToRecentlyPlayed(song)
    router.push(
      `/player?id=${encodeURIComponent(song.id)}&title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}&thumbnail=${encodeURIComponent(song.thumbnail)}&type=musiva&videoId=${encodeURIComponent(song.videoId)}`
    )
  }, [playSong, router])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-background">
      <Loader2 className="w-10 h-10 animate-spin text-primary" />
    </div>
  )
  if (error || !artist) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
      <p>Artist not found</p>
      <Button onClick={() => router.back()}>Go back</Button>
    </div>
  )

  const heroThumb      = artist.thumbnail || getBestThumb(artist.thumbnails || [])
  const songs          = artist.songs?.results  || artist.songs?.items  || []
  const albums         = artist.albums?.results || artist.albums?.items || []
  const singles        = artist.singles?.results|| artist.singles?.items|| []
  const relatedArtists = artist.related?.results|| artist.related?.items|| []
  const songsParams    = artist.songs?.params   // ytmusicapi browse token for more songs
  const canLoadMore    = !!(songsParams || id)  // always true - we have artist ID

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background">
      {/* ── Hero ── */}
      <div className="relative h-56 sm:h-72 md:h-80 overflow-hidden">
        <ImageWithFallback
          src={heroThumb}
          alt={artist.name}
          className="w-full h-full object-cover object-top"
          fallback={<div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5" />}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-background" />
        <Button
          variant="ghost" size="icon"
          onClick={() => router.back()}
          className="absolute top-4 left-4 bg-black/40 hover:bg-black/60 text-white rounded-full w-10 h-10 backdrop-blur-sm"
        >
          <ChevronLeft className="w-5 h-5" />
        </Button>
      </div>

      <div className="container mx-auto px-4 pb-36 -mt-14 relative z-10 max-w-7xl">
        {/* Artist info */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold mb-2">{artist.name}</h1>
          {artist.subscribers && (
            <div className="flex items-center gap-1.5 text-muted-foreground mb-3">
              <Users className="w-4 h-4" />
              <span className="text-sm">{artist.subscribers}</span>
            </div>
          )}
          {artist.description && (
            <p className="text-sm text-muted-foreground leading-relaxed max-w-2xl line-clamp-4">{artist.description}</p>
          )}
        </div>

        {/* ── Top Songs ── */}
        {songs.length > 0 && (
          <section className="mb-10">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-primary" />
                <h2 className="text-xl font-bold">Top Songs</h2>
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{songs.length}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {songs.map((track: any, idx: number) => (
                <SongCard key={idx} song={toSong(track)} />
              ))}
            </div>

            {/* Show All Songs button */}
            <div className="flex justify-center mt-6">
              <button
                onClick={() => setShowAllSongs(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full border border-border/50 bg-card/30 hover:bg-card/60 hover:border-primary/40 transition-all text-sm font-medium group"
              >
                <LayoutGrid className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                Show all songs by {artist.name}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </button>
            </div>
          </section>
        )}

        {/* ── Albums ── */}
        {albums.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-5">Albums</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {albums.map((album: any, idx: number) => (
                <MediaCard
                  key={idx}
                  item={album}
                  label={album.year || "Album"}
                  onClick={() => album.browseId && router.push(`/album?id=${album.browseId}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Singles ── */}
        {singles.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-5">Singles & EPs</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
              {singles.map((s: any, idx: number) => (
                <MediaCard
                  key={idx}
                  item={s}
                  label={s.year || "Single"}
                  onClick={() => s.browseId && router.push(`/album?id=${s.browseId}`)}
                />
              ))}
            </div>
          </section>
        )}

        {/* ── Related Artists ── */}
        {relatedArtists.length > 0 && (
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-5">Fans Also Like</h2>
            <div className="flex gap-5 overflow-x-auto pb-3 scrollbar-hide">
              {relatedArtists.map((ra: any, idx: number) => {
                const thumb = ra.thumbnail || getBestThumb(ra.thumbnails || [])
                return (
                  <div
                    key={idx}
                    onClick={() => ra.browseId && router.push(`/artist?id=${ra.browseId}`)}
                    className="flex-shrink-0 w-24 sm:w-28 text-center cursor-pointer group"
                  >
                    <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden bg-muted mx-auto mb-2 ring-2 ring-transparent group-hover:ring-primary transition-all">
                      <ImageWithFallback
                        src={thumb}
                        alt={ra.title || ra.name}
                        className="w-full h-full object-cover"
                        fallback={<div className="w-full h-full flex items-center justify-center"><Users className="w-6 h-6 text-muted-foreground/30" /></div>}
                      />
                    </div>
                    <p className="text-xs font-medium truncate">{ra.title || ra.name}</p>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </div>

      {/* ── All Songs fullscreen panel ── */}
      {showAllSongs && id && artist.name && (
        <AllSongsPanel
          artistId={id}
          artistName={artist.name}
          onClose={() => setShowAllSongs(false)}
          onPlay={playSongItem}
        />
      )}
    </div>
  )
}

export default function ArtistPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    }>
      <ArtistContent />
    </Suspense>
  )
}
