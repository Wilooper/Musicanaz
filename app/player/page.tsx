"use client"

import { useEffect, useRef, Suspense, useState, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  ChevronDown, Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Heart, ListPlus, AlignLeft,
  ListMusic, Music, GripVertical, Trash2, ChevronUp, ChevronDown as ChevronDownIcon,
  Zap, Download, Check, Radio, Loader2 as SpinnerIcon,
  Type, Languages, Sparkles, RotateCcw, Share2, Link2 as Link,
  Maximize2, Timer, Users, QrCode, Copy, Clock, Smile, Star, X as XIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import ImageWithFallback from "@/components/image-with-fallback"
import { Slider } from "@/components/ui/slider"
import { useAudio } from "@/lib/audio-context"
import {
  isLiked, toggleLike, getPlaylists,
  addSongToPlaylist, createPlaylist, addToRecentlyPlayed,
  addToDownloaded, isDownloaded, getPreferences,
  getReactions, addReaction, type Reaction,
  getFavMoments, saveFavMoment, deleteFavMoment, type FavMoment,
} from "@/lib/storage"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { Song } from "@/lib/types"
import {
  Drawer, DrawerContent, DrawerDescription,
  DrawerFooter, DrawerHeader, DrawerTitle,
} from "@/components/ui/drawer"
import { useMediaQuery } from "@/lib/hooks"
import ShareCardGenerator from "@/components/share-card-generator"

function fmt(s: number) {
  if (isNaN(s) || s < 0) return "0:00"
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`
}

// ─── Drag-to-reorder queue row ─────────────────────────────
interface QueueRowProps {
  song: Song
  idx: number
  isActive: boolean
  isPast: boolean
  isPlaying: boolean
  isDraggingThis: boolean
  isDropTarget: boolean
  total: number
  onPlay: () => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onDragStart: (e: React.DragEvent) => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent) => void
  onDragEnd: () => void
  onTouchStart: (e: React.TouchEvent) => void
}

function QueueRow({
  song, idx, isActive, isPast, isPlaying,
  isDraggingThis, isDropTarget, total,
  onPlay, onRemove, onMoveUp, onMoveDown,
  onDragStart, onDragOver, onDrop, onDragEnd, onTouchStart,
}: QueueRowProps) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onTouchStart={onTouchStart}
      className={[
        "flex items-center gap-2 px-2 py-2.5 rounded-xl mb-0.5 transition-all duration-150 select-none",
        "border",
        isActive  ? "bg-primary/20 border-primary/40" : "border-transparent",
        isPast    ? "opacity-35" : "",
        isDraggingThis ? "opacity-40 scale-[0.97] bg-white/10 border-white/20" : "",
        isDropTarget   ? "border-primary/70 bg-primary/10 scale-[1.01]" : "",
        !isDraggingThis && !isActive ? "hover:bg-white/5" : "",
      ].filter(Boolean).join(" ")}
    >
      {/* Drag handle */}
      <div className="touch-none cursor-grab active:cursor-grabbing p-1 text-muted-foreground/30 hover:text-muted-foreground/70 transition-colors flex-shrink-0">
        <GripVertical className="w-4 h-4" />
      </div>

      {/* Thumbnail */}
      <div
        className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted relative cursor-pointer"
        onClick={onPlay}
      >
        <ImageWithFallback
          src={song.thumbnail || "/placeholder.svg"}
          alt={song.title}
          className="w-full h-full object-cover"
          fallback={
            <img
              src="https://via.placeholder.com/40?text=♪"
              alt={song.title}
              className="w-full h-full object-cover"
            />
          }
        />
        {isActive && isPlaying && (
          <div className="absolute inset-0 bg-primary/70 flex items-center justify-center">
            <div className="flex gap-px items-end h-4">
              {[4,7,5].map((h, i) => (
                <div
                  key={i}
                  className="w-1 bg-white rounded-sm"
                  style={{ height: h, animation: `pulse ${0.5 + i * 0.15}s ease-in-out infinite alternate` }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onPlay}>
        <p className={`text-xs font-semibold truncate leading-tight ${isActive ? "text-primary" : ""}`}>
          {song.title}
        </p>
        <p className="text-[11px] text-muted-foreground/70 truncate">{song.artist}</p>
      </div>

      {/* Duration */}
      {song.duration && (
        <span className="text-[11px] text-muted-foreground flex-shrink-0 hidden sm:block tabular-nums">
          {song.duration}
        </span>
      )}

      {/* Up/down arrows */}
      <div className="flex flex-col flex-shrink-0">
        <button
          onClick={onMoveUp}
          disabled={idx === 0}
          className="p-0.5 text-muted-foreground/40 hover:text-foreground disabled:opacity-10 transition-colors"
          aria-label="Move up"
        >
          <ChevronUp className="w-3 h-3" />
        </button>
        <button
          onClick={onMoveDown}
          disabled={idx === total - 1}
          className="p-0.5 text-muted-foreground/40 hover:text-foreground disabled:opacity-10 transition-colors"
          aria-label="Move down"
        >
          <ChevronDownIcon className="w-3 h-3" />
        </button>
      </div>

      {/* Remove */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground/30 hover:text-red-400 hover:bg-red-400/10 transition-colors"
        aria-label="Remove from queue"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}

// ─── Queue panel ─────────────────────────────────────────
function QueuePanel({
  queue, queueIndex, isPlaying, onPlaySong, onRemove, onMove,
}: {
  queue: Song[]
  queueIndex: number
  isPlaying: boolean
  onPlaySong: (song: Song, idx: number) => void
  onRemove: (idx: number) => void
  onMove: (from: number, to: number) => void
}) {
  const [dragFrom,    setDragFrom]    = useState<number | null>(null)
  const [dropTarget,  setDropTarget]  = useState<number | null>(null)
  // Touch drag state
  const touchingIdx   = useRef<number | null>(null)
  const longPressRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const listRef       = useRef<HTMLDivElement>(null)
  const ROW_H         = 56 // approximate row height px

  const endDrag = () => { setDragFrom(null); setDropTarget(null) }

  // Desktop drag handlers
  const onDragStart = (e: React.DragEvent, i: number) => {
    setDragFrom(i)
    e.dataTransfer.effectAllowed = "move"
  }
  const onDragOver  = (e: React.DragEvent, i: number) => { e.preventDefault(); setDropTarget(i) }
  const onDrop      = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    if (dragFrom !== null && dragFrom !== i) onMove(dragFrom, i)
    endDrag()
  }

  // Touch long-press drag
  const onTouchStart = (e: React.TouchEvent, i: number) => {
    longPressRef.current = setTimeout(() => { touchingIdx.current = i }, 400)
  }
  const onListTouchMove = (e: React.TouchEvent) => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
    if (touchingIdx.current === null || !listRef.current) return
    const y     = e.touches[0].clientY
    const rect  = listRef.current.getBoundingClientRect()
    const relY  = y - rect.top + listRef.current.scrollTop
    const newTo = Math.max(0, Math.min(queue.length - 1, Math.floor(relY / ROW_H)))
    setDropTarget(newTo)
  }
  const onListTouchEnd = () => {
    if (longPressRef.current) { clearTimeout(longPressRef.current); longPressRef.current = null }
    if (touchingIdx.current !== null && dropTarget !== null && touchingIdx.current !== dropTarget) {
      onMove(touchingIdx.current, dropTarget)
    }
    touchingIdx.current = null
    setDropTarget(null)
  }

  if (queue.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
        <Music className="w-10 h-10 opacity-20" />
        <p className="text-sm">Queue is empty</p>
      </div>
    )
  }

  return (
    <div
      ref={listRef}
      className="flex-1 overflow-y-auto overscroll-contain"
      onTouchMove={onListTouchMove}
      onTouchEnd={onListTouchEnd}
    >
      {queue.map((song, idx) => (
        <QueueRow
          key={`${song.id}-${idx}`}
          song={song}
          idx={idx}
          total={queue.length}
          isActive={idx === queueIndex}
          isPast={idx < queueIndex}
          isPlaying={isPlaying}
          isDraggingThis={dragFrom === idx || touchingIdx.current === idx}
          isDropTarget={dropTarget === idx && dragFrom !== idx && touchingIdx.current !== idx}
          onPlay={() => onPlaySong(song, idx)}
          onRemove={() => onRemove(idx)}
          onMoveUp={() => onMove(idx, idx - 1)}
          onMoveDown={() => onMove(idx, idx + 1)}
          onDragStart={e => onDragStart(e, idx)}
          onDragOver={e => onDragOver(e, idx)}
          onDrop={e => onDrop(e, idx)}
          onDragEnd={endDrag}
          onTouchStart={e => onTouchStart(e, idx)}
        />
      ))}
    </div>
  )
}

// ─── Main player content ──────────────────────────────────
function PlayerContent() {
  const isDesktop = useMediaQuery("(min-width: 768px)")
  const router    = useRouter()
  const params    = useSearchParams()
  const lyricsRef = useRef<HTMLDivElement>(null)

  const [liked,              setLiked]              = useState(false)
  const [showPlaylistDlg,    setShowPlaylistDlg]    = useState(false)
  const [showNewPlaylistDlg, setShowNewPlaylistDlg] = useState(false)
  const [newPlaylistName,    setNewPlaylistName]    = useState("")
  const [showLyrics,         setShowLyrics]         = useState(false)
  const [lyricsFullscreen,   setLyricsFullscreen]   = useState(false)
  const [showQueue,          setShowQueue]          = useState(false)
  // SponsorBlock POI (highlight)
  const [highlight,          setHighlight]          = useState<number | null>(null)
  const [showHighlightBtn,   setShowHighlightBtn]   = useState(false)
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Download state
  const [downloaded,         setDownloaded]         = useState(false)
  // Podcast mode
  const [podcastEpisodes,    setPodcastEpisodes]    = useState<any[]>([])
  const [podcastEpiLoading,  setPodcastEpiLoading]  = useState(false)
  // AI transliteration / translation
  const [aiLines,            setAiLines]            = useState<string[] | null>(null)
  const [aiMode,             setAiMode]             = useState<"transliterate"|"translate"|null>(null)
  const [aiLoading,          setAiLoading]          = useState(false)
  const [aiError,            setAiError]            = useState<string|null>(null)
  // Share feature
  const [showShareDialog,    setShowShareDialog]    = useState(false)
  const [shareTimestamp,      setShareTimestamp]      = useState(0)
  const [shareUseTimestamp,   setShareUseTimestamp]   = useState(false)
  const [shareEndTimestamp,   setShareEndTimestamp]   = useState(0)
  const [shareUseEndTimestamp,setShareUseEndTimestamp]= useState(false)
  const [shareCopied,         setShareCopied]         = useState(false)
  const [shareTab,            setShareTab]            = useState<"link" | "card">("link")
  const [showLikeAnim,       setShowLikeAnim]       = useState(false)
  // Favourite moments (triple-tap thumbnail to bookmark current position)
  const [favMoments,         setFavMoments]         = useState<FavMoment[]>([])
  const [showFavSaved,       setShowFavSaved]       = useState(false)
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showSleepTimerDlg,  setShowSleepTimerDlg]  = useState(false)
  const [sleepTimeMinutes,   setSleepTimeMinutes]   = useState(0)
  const [sleepTimerActive,   setSleepTimerActive]   = useState(false)
  const [sleepRemaining,     setSleepRemaining]     = useState(0)
  const [sleepMode,          setSleepMode]          = useState<"timer" | "song">("timer")
  const [showPartyDlg,       setShowPartyDlg]       = useState(false)

  // Reactions timeline
  const [reactions,          setReactions]          = useState<Reaction[]>([])
  const [floatingReactions,  setFloatingReactions]  = useState<{ id: number; emoji: string; x: number }[]>([])
  const floatingIdRef = useRef(0)
  const REACTION_EMOJIS = ["🔥","❤️","😍","🎵","💃","🙌","😭","✨"]

  const {
    currentSong, isPlaying, currentTime, duration,
    volume, lyrics, lyricsLoading, lyricsNotFound, currentLyricIndex,
    playSong, togglePlayPause, seek, setVolume,
    playNext, playPrev, stopSong,
    queue, queueIndex, isLoading,
    removeFromQueue, moveInQueue,
    partyId, isPartyHost, startParty, stopParty,
    stopAtTime,
    queueExhausted, suggestions, dismissSuggestions, playFromSuggestions,
    crossfadeSecs, setCrossfadeSecs,
  } = useAudio()

  const songId      = params.get("id")           || ""
  const title       = params.get("title")        || ""
  const artist      = params.get("artist")       || ""
  const thumbnail   = params.get("thumbnail")    || ""
  const type        = params.get("type")         || "musiva"
  const videoId     = params.get("videoId")      || ""
  const isPodcastParam = params.get("isPodcast") === "1"
  const podcastId   = params.get("podcastId")    || ""
  const podcastTitle = params.get("podcastTitle") || ""
  const playlists   = getPlaylists()

  // Podcast mode: from URL param OR from currentSong flag
  const isPodcast = isPodcastParam || !!currentSong?.isPodcast

  const displayTitle     = currentSong?.title     || title
  const displayArtist    = currentSong?.artist    || artist
  const displayThumbnail = currentSong?.thumbnail || thumbnail

  const startTimestamp = Number(params.get("t") || 0)
  const endTimestamp   = Number(params.get("e") || 0)

  useEffect(() => {
    if (songId && title && artist && (!currentSong || currentSong.id !== songId)) {
      // Pass stopAt directly into playSong — it's stored in pendingStopAtRef
      // and applied the moment the YT player fires the PLAYING state.
      // This is race-free regardless of how long YT takes to load on mobile.
      playSong({
        id: songId, title, artist, thumbnail, type: type as any, videoId: videoId || songId,
        isPodcast: isPodcastParam || undefined,
        podcastId: podcastId || undefined,
        podcastTitle: podcastTitle || undefined,
      }, true, startTimestamp, endTimestamp > startTimestamp ? endTimestamp : 0)
    }
  }, [songId, startTimestamp, endTimestamp]) // eslint-disable-line

  // Fetch podcast episodes when in podcast mode
  useEffect(() => {
    const pid = podcastId || currentSong?.podcastId
    if (!pid || !isPodcast) { setPodcastEpisodes([]); return }
    setPodcastEpiLoading(true)
    fetch(`/api/musiva/podcast?id=${encodeURIComponent(pid)}&limit=50`)
      .then(r => r.json())
      .then(data => {
        const eps: any[] = data.episodes || []
        // Filter out the currently playing episode
        const vid = videoId || songId
        const rest = eps.filter(ep => ep.videoId !== vid)
        setPodcastEpisodes(rest)
        setPodcastEpiLoading(false)
      })
      .catch(() => { setPodcastEpisodes([]); setPodcastEpiLoading(false) })
  }, [isPodcast, podcastId, currentSong?.podcastId, videoId, songId]) // eslint-disable-line

  useEffect(() => { if (songId) setLiked(isLiked(songId)) }, [songId])
  useEffect(() => {
    setLyricsFullscreen(false)
    setAiLines(null)
    setAiMode(null)
    setAiError(null)
  }, [songId])  // reset on song change
  useEffect(() => { setDownloaded(false) }, [songId])  // reset on song change

  // Sync URL when currentSong changes via auto-advance through queue
  useEffect(() => {
    if (!currentSong) return
    if (currentSong.id && currentSong.id !== songId) {
      const ps: Record<string, string> = {
        id:        currentSong.id,
        title:     currentSong.title,
        artist:    currentSong.artist,
        thumbnail: currentSong.thumbnail || "",
        type:      currentSong.type,
        videoId:   currentSong.videoId || currentSong.id,
      }
      if (currentSong.isPodcast)    ps.isPodcast    = "1"
      if (currentSong.podcastId)    ps.podcastId    = currentSong.podcastId
      if (currentSong.podcastTitle) ps.podcastTitle = currentSong.podcastTitle
      const qs = new URLSearchParams(ps).toString()
      router.replace(`/player?${qs}`)
    }
  }, [currentSong?.id]) // eslint-disable-line

  // Sleep Timer logic
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>
    if (sleepTimerActive && sleepRemaining > 0 && isPlaying) {
      interval = setInterval(() => {
        setSleepRemaining(prev => {
          if (prev <= 1) {
            stopSong()
            setSleepTimerActive(false)
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [sleepTimerActive, sleepRemaining, isPlaying, stopSong])

  // Sleep-on-song-end: stop when current song finishes
  useEffect(() => {
    if (sleepMode === "song" && sleepTimerActive && !isPlaying && currentTime > 0 && duration > 0) {
      const remaining = duration - currentTime
      if (remaining < 1) {
        stopSong()
        setSleepTimerActive(false)
      }
    }
  }, [isPlaying, currentTime, duration, sleepMode, sleepTimerActive, stopSong])

  // Favourite moments — reload when song changes
  useEffect(() => {
    const vid = currentSong?.videoId || currentSong?.id || songId
    if (vid) setFavMoments(getFavMoments(vid))
    else     setFavMoments([])
  }, [currentSong?.id, songId])

  // Load reactions for current song
  useEffect(() => {
    const id = currentSong?.id || currentSong?.videoId
    if (!id) { setReactions([]); return }
    setReactions(getReactions(id))
  }, [currentSong])

  // Fire stored reactions as floating emojis at the right timestamp
  useEffect(() => {
    const id = currentSong?.id || currentSong?.videoId
    if (!id || !reactions.length) return
    const currentSec = Math.floor(currentTime)
    const matching = reactions.filter(r => Math.abs(r.timestamp - currentSec) < 1)
    if (matching.length > 0) {
      matching.forEach(r => fireFloating(r.emoji))
    }
  }, [Math.floor(currentTime)]) // eslint-disable-line

  const startSleepTimer = (mins: number, mode: "timer" | "song" = "timer") => {
    if (mins === 0 && mode === "timer") {
      setSleepTimerActive(false)
      setSleepRemaining(0)
    } else {
      setSleepMode(mode)
      if (mode === "timer") setSleepRemaining(mins * 60)
      setSleepTimerActive(true)
    }
    setShowSleepTimerDlg(false)
  }

  const fireFloating = (emoji: string) => {
    const id = ++floatingIdRef.current
    const x  = 10 + Math.random() * 80   // % from left
    setFloatingReactions(prev => [...prev, { id, emoji, x }])
    setTimeout(() => setFloatingReactions(prev => prev.filter(f => f.id !== id)), 2500)
  }

  const tapReaction = (emoji: string) => {
    const songId = currentSong?.id || currentSong?.videoId
    if (!songId) return
    addReaction(songId, emoji, currentTime)
    setReactions(getReactions(songId))
    fireFloating(emoji)
  }

  // Fetch SponsorBlock highlight (POI) when video changes
  useEffect(() => {
    const vid = videoId || songId
    if (!vid) return
    setHighlight(null)
    setShowHighlightBtn(false)
    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
    fetch(`/api/sponsorblock?videoId=${encodeURIComponent(vid)}`)
      .then(r => r.json())
      .then(data => {
        if (data.found && data.highlight !== null) {
          setHighlight(data.highlight)
          setShowHighlightBtn(true)
          // Auto-hide after 35 seconds
          highlightTimerRef.current = setTimeout(() => setShowHighlightBtn(false), 35000)
        }
      })
      .catch(() => {})
    return () => { if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current) }
  }, [videoId, songId])

  useEffect(() => {
    const container = lyricsRef.current
    if (!container || currentLyricIndex < 0) return
    const el = container.querySelector(`[data-idx="${currentLyricIndex}"]`) as HTMLElement | null
    if (!el) return
    // Scroll so active line is vertically centered in the container
    const containerH = container.clientHeight
    const elTop      = el.offsetTop
    const elH        = el.offsetHeight
    container.scrollTo({ top: elTop - containerH / 2 + elH / 2, behavior: "smooth" })
  }, [currentLyricIndex])

  // Auto-open lyrics when a song starts and lyrics are loaded (optional UX improvement)
  useEffect(() => {
    if (lyrics.length > 0 && !lyricsFullscreen) {
      // Don't force-open, just ensure panel is scrolled to current line
    }
  }, [lyrics.length]) // eslint-disable-line

  // AI transform cache helpers — keyed by songId+mode+lang stored in localStorage
  const getAiCacheKey = (songId: string, mode: string, lang: string) =>
    `musicana_ai_${songId}_${mode}_${lang.replace(/[^a-zA-Z]/g, "")}`

  const getAiCache = (key: string): string[] | null => {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) return null
      const { lines, expiresAt } = JSON.parse(raw)
      if (Date.now() > expiresAt) { localStorage.removeItem(key); return null }
      return lines
    } catch { return null }
  }

  const setAiCache = (key: string, lines: string[]) => {
    try {
      // Cache for 7 days
      localStorage.setItem(key, JSON.stringify({ lines, expiresAt: Date.now() + 7 * 24 * 3600 * 1000 }))
    } catch {}
  }

  // AI transform — transliterate or translate lyrics via Groq (with localStorage cache)
  const handleAiTransform = async (mode: "transliterate" | "translate") => {
    if (!lyrics.length) return
    const prefs = getPreferences()
    if (!prefs.groqApiKey) return

    // Toggle off if same mode already active
    if (aiMode === mode && aiLines) {
      setAiLines(null); setAiMode(null)
      return
    }

    const lang    = prefs.transliterateLanguage || "English"
    const vid     = currentSong?.videoId || currentSong?.id || songId
    const cacheKey = getAiCacheKey(vid, mode, lang)

    // Check localStorage cache first — avoids spending Groq credits
    const cached = vid ? getAiCache(cacheKey) : null
    if (cached) {
      setAiLines(cached)
      setAiMode(mode)
      return
    }

    setAiLoading(true)
    setAiError(null)
    setAiMode(mode)
    try {
      const res = await fetch("/api/groq/transform", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lines:          lyrics.map(l => l.text),
          mode,
          targetLanguage: lang,
          apiKey:         prefs.groqApiKey,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "AI transform failed")
      setAiLines(data.lines)
      // Cache result so we don't hit Groq again for this song+mode+lang
      if (vid) setAiCache(cacheKey, data.lines)
    } catch (err: any) {
      setAiError(err.message || "AI error")
      setAiMode(null)
    } finally {
      setAiLoading(false)
    }
  }

  // Share song — build URL with optional timestamp
  const handleShare = () => {
    setShareTimestamp(Math.floor(currentTime))
    setShareCopied(false)
    setShareTab("link")
    setShowShareDialog(true)
  }

  const handleStartParty = async () => {
    await startParty()
  }

  const getPartyUrl = () => {
    const base = typeof window !== "undefined" ? window.location.origin : ""
    return `${base}/party/${partyId}`
  }

  const buildShareUrl = () => {
    const vid   = currentSong?.videoId || currentSong?.id || videoId || songId
    const t     = currentSong?.title     || title
    const ar    = currentSong?.artist    || artist
    const th    = currentSong?.thumbnail || thumbnail
    const base  = typeof window !== "undefined" ? window.location.origin : ""
    const p: Record<string, string> = {
      id: vid, title: t, artist: ar, thumbnail: th, type: "musiva", videoId: vid,
    }
    if (shareUseTimestamp    && shareTimestamp    > 0) p.t = String(shareTimestamp)
    if (shareUseEndTimestamp && shareEndTimestamp > 0
        && shareEndTimestamp > (shareUseTimestamp ? shareTimestamp : 0)) {
      p.e = String(shareEndTimestamp)
    }
    // /song route gives rich OG preview in messaging apps; it then redirects to /player
    return `${base}/song?${new URLSearchParams(p).toString()}`
  }

  const copyShareUrl = async () => {
    try {
      await navigator.clipboard.writeText(buildShareUrl())
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2500)
    } catch {
      // fallback
      const ta = document.createElement("textarea")
      ta.value = buildShareUrl()
      document.body.appendChild(ta); ta.select()
      document.execCommand("copy")
      document.body.removeChild(ta)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2500)
    }
  }

  const nativeShare = async () => {
    const url  = buildShareUrl()
    const t    = currentSong?.title  || title
    const ar   = currentSong?.artist || artist
    if (navigator.share) {
      try {
        await navigator.share({ title: `${t} – ${ar}`, text: `Listen to ${t} by ${ar} on MUSICANA`, url })
      } catch {}
    } else {
      copyShareUrl()
    }
  }

  const handleLike = () => {
    if (currentSong) {
      const newState = toggleLike(currentSong)
      setLiked(newState)
      if (newState) {
        setShowLikeAnim(true)
        setTimeout(() => setShowLikeAnim(false), 800)
      }
    }
  }

  // Triple-tap thumbnail → bookmark current position as a favourite moment
  const handleTripleTap = useCallback(() => {
    tapCountRef.current += 1
    if (tapTimerRef.current) clearTimeout(tapTimerRef.current)
    tapTimerRef.current = setTimeout(() => { tapCountRef.current = 0 }, 600)
    if (tapCountRef.current >= 3) {
      tapCountRef.current = 0
      if (tapTimerRef.current) { clearTimeout(tapTimerRef.current); tapTimerRef.current = null }
      const vid = currentSong?.videoId || currentSong?.id || songId
      if (!vid || currentTime <= 0) return
      saveFavMoment(vid, currentTime)
      setFavMoments(getFavMoments(vid))
      setShowFavSaved(true)
      setTimeout(() => setShowFavSaved(false), 2000)
    }
  }, [currentSong, songId, currentTime])

  // Download — opens YouTube Music in new tab (actual audio extraction not possible client-side)
  const handleDownload = () => {
    if (!currentSong) return
    const vid = currentSong.videoId || currentSong.id
    if (!vid) return
    // Open YouTube Music link — user can download from there or use yt-dlp
    const ytUrl = `https://music.youtube.com/watch?v=${encodeURIComponent(vid)}`
    window.open(ytUrl, "_blank", "noopener,noreferrer")
    setDownloaded(true)
    addToDownloaded({
      ...currentSong,
      audioUrl: ytUrl,
      cachedAt: Date.now(),
      downloadedAt: Date.now(),
    })
  }

  const handleSelectPlaylist = (pid: string) => {
    if (!currentSong) return
    addSongToPlaylist(pid, currentSong)
    setShowPlaylistDlg(false)
  }

  const handleCreatePlaylist = () => {
    if (!newPlaylistName.trim()) return
    const pl = createPlaylist(newPlaylistName)
    if (currentSong) addSongToPlaylist(pl.id, currentSong)
    setNewPlaylistName(""); setShowNewPlaylistDlg(false); setShowPlaylistDlg(false)
  }

  const playQueueSong = useCallback((song: Song, idx: number) => {
    addToRecentlyPlayed(song)
    playSong(song, false)
    router.replace(
      `/player?id=${encodeURIComponent(song.id)}&title=${encodeURIComponent(song.title)}&artist=${encodeURIComponent(song.artist)}&thumbnail=${encodeURIComponent(song.thumbnail)}&type=musiva&videoId=${encodeURIComponent(song.videoId || song.id)}`
    )
  }, [playSong, router])

  const nextSong    = queue[queueIndex + 1]
  const remaining   = Math.max(0, queue.length - queueIndex - 1)
  const nextPreview = queue.slice(Math.max(0, queueIndex + 1), queueIndex + 4)

  return (
    <div className="h-screen max-h-screen bg-gradient-to-b from-primary/30 via-background to-background relative overflow-hidden flex flex-col">
      {/* Blurred album art background */}
      {displayThumbnail && (
        <div
          className="absolute inset-0 opacity-20 blur-3xl scale-125 pointer-events-none"
          style={{ backgroundImage: `url(${displayThumbnail})`, backgroundSize: "cover", backgroundPosition: "center" }}
        />
      )}

      <div className="relative z-10 flex flex-col flex-1 min-h-0">
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-1 flex-shrink-0">
          <Button
            variant="ghost" size="icon"
            onClick={() => router.push("/")}
            className="rounded-full w-10 h-10 bg-black/20 backdrop-blur-md border border-white/10"
          >
            <ChevronDown className="w-5 h-5" />
          </Button>
          <span className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground font-semibold">
            {showQueue ? "Up Next" : "Now Playing"}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="icon"
              onClick={() => setShowPartyDlg(true)}
              className={`rounded-full w-10 h-10 bg-black/20 backdrop-blur-md border border-white/10 ${partyId ? "text-primary border-primary/40" : ""}`}
            >
              <Users className="w-4.5 h-4.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={() => router.push("/history")}
              className="rounded-full w-10 h-10 bg-black/20 backdrop-blur-md border border-white/10"
              title="Song History"
            >
              <Clock className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={() => setShowSleepTimerDlg(true)}
              className={`rounded-full w-10 h-10 bg-black/20 backdrop-blur-md border border-white/10 ${sleepTimerActive ? "text-primary border-primary/40" : ""}`}
            >
              <Timer className="w-4.5 h-4.5" />
            </Button>
            <Button
              variant="ghost" size="icon"
              onClick={() => { setShowQueue(v => !v); if (!showQueue) setShowLyrics(false) }}
              className={`rounded-full w-10 h-10 bg-black/20 backdrop-blur-md border border-white/10 ${showQueue ? "text-primary border-primary/40" : ""}`}
            >
              <ListMusic className="w-4.5 h-4.5" />
            </Button>
          </div>
        </div>

        {/* ── Queue panel ── */}
        {showQueue ? (
          <div className="flex-1 flex flex-col px-4 pb-4 min-h-0 overflow-hidden">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <div>
                <h2 className="font-bold text-sm">{queue.length} songs · hold & drag to reorder</h2>
              </div>
            </div>
            <QueuePanel
              queue={queue}
              queueIndex={queueIndex}
              isPlaying={isPlaying}
              onPlaySong={playQueueSong}
              onRemove={removeFromQueue}
              onMove={moveInQueue}
            />
          </div>
        ) : (
          /* ── Player view ── */
          <div className="flex-1 overflow-y-auto overscroll-contain flex flex-col">
            {/* Album art — fluid size */}
            <div className="flex justify-center px-8 mt-3 mb-4 flex-shrink-0">
              <div
                onDoubleClick={handleLike}
                onClick={handleTripleTap}
                className={[
                  "relative overflow-hidden rounded-2xl shadow-2xl transition-all duration-500 cursor-pointer active:scale-95",
                  "w-[min(72vw,260px)] sm:w-[min(72vw,288px)] aspect-square",
                  isPlaying ? "scale-100" : "scale-[0.94] opacity-80",
                ].join(" ")}
              >
                <ImageWithFallback
                  src={displayThumbnail || "/placeholder.svg"}
                  alt={displayTitle}
                  className="w-full h-full object-cover select-none"
                  fallback={
                    <img
                      src="https://via.placeholder.com/288?text=♪"
                      alt={displayTitle}
                      className="w-full h-full object-cover select-none"
                    />
                  }
                />
                {showLikeAnim && (
                  <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none animate-in zoom-in duration-300">
                    <Heart className="w-20 h-20 text-red-500 fill-red-500 drop-shadow-2xl" />
                  </div>
                )}
                {showFavSaved && (
                  <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none animate-in fade-in duration-200">
                    <div className="flex flex-col items-center gap-1.5 bg-black/70 rounded-2xl px-5 py-3 backdrop-blur-sm">
                      <Star className="w-10 h-10 text-amber-400 fill-amber-400 drop-shadow-lg" />
                      <span className="text-white text-xs font-semibold">Moment saved!</span>
                      <span className="text-white/60 text-[10px] font-mono">{fmt(Math.round(currentTime))}</span>
                    </div>
                  </div>
                )}
                {isLoading && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="w-7 h-7 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  </div>
                )}
              </div>
            </div>

            {/* Song info */}
            <div className="px-6 mb-3 text-center flex-shrink-0">
              <h1 className="text-xl font-bold truncate px-2">{displayTitle}</h1>
              <p className="text-sm text-muted-foreground truncate mt-0.5">{displayArtist}</p>
            </div>

            {/* ── Floating Reaction Emojis ── */}
            {floatingReactions.length > 0 && (
              <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
                {floatingReactions.map(f => (
                  <div
                    key={f.id}
                    className="absolute text-2xl animate-bounce"
                    style={{
                      left:      `${f.x}%`,
                      bottom:    "30%",
                      animation: "floatUp 2.5s ease-out forwards",
                    }}
                  >
                    {f.emoji}
                  </div>
                ))}
              </div>
            )}

            {/* ── Reaction Emoji Bar ──
                Tap bar is hidden when reactionsEnabled=false in Settings.
                Stored reactions still fire as floating emojis regardless — they were
                placed when the feature was on and should still play back. */}
            {currentSong && !isPodcast && getPreferences().reactionsEnabled && (
              <div className="px-4 mb-3 flex-shrink-0">
                <div className="flex items-center justify-between bg-white/5 backdrop-blur-sm rounded-2xl px-3 py-2 border border-white/8">
                  <div className="flex gap-1.5">
                    {REACTION_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => tapReaction(emoji)}
                        className="text-lg w-8 h-8 flex items-center justify-center rounded-xl hover:bg-white/15 active:scale-125 transition-all"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                  {reactions.length > 0 && (
                    <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 ml-1">
                      {reactions.length}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Action buttons — podcast mode hides lyrics & download */}
            <div className="flex items-center justify-center gap-4 px-6 mb-2 flex-shrink-0">
              <button
                onClick={handleLike}
                className={`p-2.5 rounded-full hover:bg-white/10 transition-all ${liked ? "text-red-500 scale-110" : "text-muted-foreground"}`}
                title="Like"
              >
                <Heart className="w-5 h-5" fill={liked ? "currentColor" : "none"} />
              </button>
              <button
                onClick={() => setShowPlaylistDlg(true)}
                className="p-2.5 rounded-full hover:bg-white/10 transition-colors text-muted-foreground"
                title="Add to Playlist"
              >
                <ListPlus className="w-5 h-5" />
              </button>
              {/* Lyrics — hidden for podcasts */}
              {!isPodcast && (
                <button
                  onClick={() => setShowLyrics(v => !v)}
                  className={`p-2.5 rounded-full hover:bg-white/10 transition-colors ${showLyrics ? "text-primary" : "text-muted-foreground"}`}
                  title="Lyrics"
                >
                  <AlignLeft className="w-5 h-5" />
                </button>
              )}
              {/* Download — hidden for podcasts */}
              {!isPodcast && (
                <button
                  onClick={handleDownload}
                  className={`p-2.5 rounded-full hover:bg-white/10 transition-all ${downloaded ? "text-green-400" : "text-muted-foreground"}`}
                  title={downloaded ? "Opened in YouTube Music" : "Open in YouTube Music to Download"}
                >
                  {downloaded
                    ? <Check className="w-5 h-5" />
                    : <Download className="w-5 h-5" />
                  }
                </button>
              )}
              {/* Share */}
              <button
                onClick={handleShare}
                className="p-2.5 rounded-full hover:bg-white/10 transition-colors text-muted-foreground"
                title="Share song"
              >
                <Share2 className="w-5 h-5" />
              </button>
              {/* Podcast badge — shown only in podcast mode */}
              {isPodcast && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-semibold">
                  <Radio className="w-3.5 h-3.5" />
                  Podcast
                </div>
              )}
            </div>

            {/* Lyrics — only for non-podcast */}
            {showLyrics && !isPodcast && !lyricsFullscreen && (
              <div className="relative group mx-5 mb-2 flex-shrink-0">
                <div
                  ref={lyricsRef}
                  className="max-h-36 overflow-y-auto scrollbar-hide cursor-pointer select-none pb-4"
                >
                {lyricsLoading ? (
                  <div className="flex flex-col items-center gap-2 py-3">
                    <div className="flex gap-1">
                      {[0,1,2].map(i => (
                        <span key={i} className="w-1.5 h-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground/60">Loading lyrics…</p>
                  </div>
                ) : lyrics.length > 0 ? (
                  <div className="space-y-3 py-2">
                    {/* Spacer so active line can scroll to center */}
                    <div className="h-8" />
                    {lyrics.map((line, idx) => (
                      <p
                        key={line.id}
                        data-idx={idx}
                        onClick={e => {
                          e.preventDefault()
                          e.stopPropagation()
                          seek(line.start_time / 1000)
                        }}
                        className={`text-center text-sm font-medium transition-all duration-300 cursor-pointer select-none py-1 ${
                          idx === currentLyricIndex
                            ? "text-foreground scale-105 opacity-100"
                            : "text-muted-foreground/30 hover:text-muted-foreground/60"
                        }`}
                      >
                        {line.text}
                      </p>
                    ))}
                    <div className="h-8" />
                  </div>
                ) : lyricsNotFound ? (
                  <p className="text-center text-xs text-muted-foreground/60 py-3">No lyrics found</p>
                ) : null}
                  {!lyricsLoading && (lyrics.length > 0 || lyricsNotFound) && (
                    <p className="text-center text-[9px] text-muted-foreground/30 mt-1 pb-1 flex items-center justify-center gap-1">
                      tap line to seek
                    </p>
                  )}
                </div>
                {/* Maximize button for mobile accessibility */}
                {lyrics.length > 0 && (
                  <button
                    onClick={() => setLyricsFullscreen(true)}
                    className="absolute top-0 right-0 p-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-lg text-white/70 hover:text-primary transition-all z-20 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Expand lyrics"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}

            {/* Fullscreen lyrics overlay */}
            {lyricsFullscreen && !isPodcast && (
              <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in zoom-in duration-300">
                {/* Close button top left */}
                <div className="absolute top-4 left-4 z-[60]">
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setLyricsFullscreen(false)}
                    className="rounded-full w-10 h-10 bg-white/10 backdrop-blur-md border border-white/10 text-white"
                  >
                    <ChevronDown className="w-6 h-6" />
                  </Button>
                </div>

                {/* ── Lyrics scroll area ── */}
                <div
                  ref={lyricsRef}
                  className="flex-1 overflow-y-auto px-6 pt-16 pb-20 scrollbar-hide"
                >
                  <div className="max-w-lg mx-auto">
                    {/* Song title */}
                    <p className="text-center text-xs text-white/30 mb-1 uppercase tracking-widest truncate">
                      {currentSong?.title}
                    </p>
                    <p className="text-center text-[10px] text-white/20 mb-5 truncate">{currentSong?.artist}</p>

                    {/* AI mode badge */}
                    {aiMode && aiLines && (
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-medium">
                          <Sparkles className="w-3 h-3" />
                          {aiMode === "transliterate" ? "Transliterated" : "Translated"}
                          {" · "}
                          {getPreferences().transliterateLanguage || "English"}
                        </div>
                        <button
                          onClick={() => { setAiLines(null); setAiMode(null) }}
                          className="p-1 text-white/30 hover:text-white/70 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Error state */}
                    {aiError && (
                      <p className="text-center text-xs text-red-400/80 mb-3 bg-red-500/10 rounded-xl px-3 py-2">
                        {aiError}
                      </p>
                    )}

                    {/* Lyrics loading */}
                    {lyricsLoading ? (
                      <div className="flex flex-col items-center gap-3 py-16">
                        <div className="flex gap-1.5">
                          {[0,1,2].map(i => (
                            <span key={i} className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                          ))}
                        </div>
                        <p className="text-sm text-white/40">Loading lyrics…</p>
                      </div>
                    ) : aiLoading ? (
                      <div className="flex flex-col items-center gap-3 py-10">
                        <div className="flex gap-1.5">
                          {[0,1,2,3].map(i => (
                            <span key={i} className="w-2 h-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: `${i*0.12}s` }} />
                          ))}
                        </div>
                        <p className="text-sm text-white/50">
                          {aiMode === "transliterate" ? "Transliterating…" : "Translating…"}
                        </p>
                        <p className="text-xs text-white/25">Powered by Llama 3.3 via Groq</p>
                      </div>
                    ) : lyrics.length > 0 ? (
                      <div className="space-y-4 pb-8">
                        {lyrics.map((line, idx) => {
                          const isActive = idx === currentLyricIndex
                          const isNear   = idx === currentLyricIndex - 1 || idx === currentLyricIndex + 1
                          const aiText   = aiLines?.[idx]
                          return (
                            <div
                              key={line.id}
                              data-idx={idx}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                seek(line.start_time / 1000)
                              }}
                              className={`text-center transition-all duration-300 cursor-pointer select-none py-2 ${
                                isActive ? "scale-100" : "scale-[0.97] hover:scale-[0.99]"
                              }`}
                            >
                              {/* Original line */}
                              <p className={`font-semibold leading-snug transition-all duration-300 ${
                                isActive
                                  ? "text-white text-xl opacity-100"
                                  : isNear
                                    ? "text-white/45 text-base"
                                    : "text-white/15 text-sm hover:text-white/30"
                              }`}>
                                {line.text}
                              </p>
                              {/* AI transformed line */}
                              {aiText && (
                                <p className={`font-medium mt-0.5 transition-all duration-300 ${
                                  isActive
                                    ? "text-primary text-base opacity-100"
                                    : isNear
                                      ? "text-primary/40 text-sm"
                                      : "text-primary/15 text-xs"
                                }`}>
                                  {aiText}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-white/40 text-lg py-16">No lyrics found</p>
                    )}
                  </div>
                </div>

                {/* ── AI action bar (only when lyrics loaded & key is set) ── */}
                {lyrics.length > 0 && (() => {
                  const prefs = getPreferences()
                  const hasKey = !!prefs.groqApiKey
                  if (!hasKey) return null
                  return (
                    <div className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-2 border-t border-white/5">
                      {prefs.transliterateEnabled && (
                        <button
                          onClick={() => handleAiTransform("transliterate")}
                          disabled={aiLoading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            aiMode === "transliterate" && aiLines
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white disabled:opacity-40"
                          }`}
                        >
                          <Type className="w-3 h-3" />
                          Romanize
                        </button>
                      )}
                      {prefs.translationEnabled && (
                        <button
                          onClick={() => handleAiTransform("translate")}
                          disabled={aiLoading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            aiMode === "translate" && aiLines
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white disabled:opacity-40"
                          }`}
                        >
                          <Languages className="w-3 h-3" />
                          Translate
                        </button>
                      )}
                      {aiLines && (
                        <button
                          onClick={() => { setAiLines(null); setAiMode(null); setAiError(null) }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border border-white/10 bg-white/5 text-white/40 hover:text-white transition-all"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Original
                        </button>
                      )}
                    </div>
                  )
                })()}

                {/* ── Mini player controls ── */}
                <div className="flex-shrink-0 border-t border-white/10 bg-black/60 backdrop-blur-md px-6 pt-3 pb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <ImageWithFallback src={displayThumbnail} alt={displayTitle} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate text-white">{displayTitle}</p>
                      <p className="text-xs text-white/50 truncate">{displayArtist}</p>
                    </div>
                    <button
                      onClick={() => setLyricsFullscreen(false)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors flex-shrink-0"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.5}
                    onValueChange={([v]) => seek(v)}
                    className="mb-1"
                  />
                  <div className="flex justify-between text-[10px] text-white/30 mb-3 tabular-nums">
                    <span>{fmt(currentTime)}</span><span>{fmt(duration)}</span>
                  </div>
                  <div className="flex items-center justify-center gap-8">
                    <button onClick={playPrev} className="p-2 text-white/60 hover:text-white transition-colors">
                      <SkipBack className="w-5 h-5" />
                    </button>
                    <button
                      onClick={togglePlayPause}
                      disabled={isLoading}
                      className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center shadow-2xl shadow-primary/40 transition-all active:scale-95 disabled:opacity-60"
                    >
                      {isLoading
                        ? <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        : isPlaying
                          ? <Pause className="w-6 h-6 text-primary-foreground" fill="currentColor" />
                          : <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
                      }
                    </button>
                    <button onClick={playNext} className="p-2 text-white/60 hover:text-white transition-colors">
                      <SkipForward className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-center text-[9px] text-white/20 mt-2">tap line to seek</p>
                </div>
              </div>
            )}

            {/* SponsorBlock highlight skip button */}
            {showHighlightBtn && highlight !== null && (
              <div className="flex justify-center mb-2 flex-shrink-0">
                <button
                  onClick={() => {
                    seek(highlight)
                    setShowHighlightBtn(false)
                    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current)
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/40 text-yellow-400 text-sm font-medium transition-all animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <Zap className="w-4 h-4" />
                  Skip to Highlight
                </button>
              </div>
            )}

            {/* ── Favourite moment jump pills ── */}
            {favMoments.length > 0 && (
              <div className="px-6 mb-2 flex-shrink-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                  {favMoments.map((m) => (
                    <div key={m.savedAt} className="flex items-center gap-0.5">
                      <button
                        onClick={() => seek(m.time)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-400 text-[11px] font-semibold transition-all active:scale-95"
                      >
                        {fmt(m.time)}
                      </button>
                      <button
                        onClick={() => {
                          const vid = currentSong?.videoId || currentSong?.id || songId
                          if (vid) { deleteFavMoment(vid, m.savedAt); setFavMoments(getFavMoments(vid)) }
                        }}
                        className="w-4 h-4 rounded-full text-muted-foreground/40 hover:text-red-400 flex items-center justify-center transition-all"
                      >
                        <XIcon className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ))}
                  <span className="text-[9px] text-muted-foreground/30 ml-auto">triple-tap to add</span>
                </div>
              </div>
            )}

            {/* Progress */}
            <div className="px-6 mb-1 flex-shrink-0">
              <Slider
                value={[currentTime]}
                max={duration || 100}
                step={0.5}
                onValueChange={([v]) => seek(v)}
                className="mb-1"
              />
              <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{fmt(currentTime)}</span>
                <span>{fmt(duration)}</span>
              </div>
            </div>

            {/* Playback controls */}
            <div className="flex items-center justify-center gap-7 px-6 mb-2 flex-shrink-0">
              <button onClick={playPrev} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <SkipBack className="w-6 h-6" />
              </button>

              <button
                onClick={togglePlayPause}
                disabled={isLoading}
                className="w-16 h-16 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center shadow-2xl shadow-primary/40 transition-all active:scale-95 disabled:opacity-60"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-7 h-7 text-primary-foreground" fill="currentColor" />
                ) : (
                  <Play className="w-7 h-7 text-primary-foreground ml-0.5" fill="currentColor" />
                )}
              </button>

              <button
                onClick={playNext}
                disabled={queueIndex >= queue.length - 1}
                className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-25"
              >
                <SkipForward className="w-6 h-6" />
              </button>
            </div>

            {/* Volume */}
            <div className="px-8 mb-3 flex-shrink-0">
              <div className="flex items-center gap-3 max-w-[280px] mx-auto">
                <button onClick={() => setVolume(volume > 0 ? 0 : 80)} className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0">
                  {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <Slider value={[volume]} max={100} step={1} onValueChange={([v]) => setVolume(v)} className="flex-1" />
              </div>
            </div>

            {/* Up Next strip — podcast mode shows next episodes, music mode shows queue */}
            {isPodcast ? (
              /* ── Podcast: next episodes strip ── */
              podcastEpiLoading ? (
                <div className="mx-4 mb-4 px-3 py-3 rounded-2xl bg-white/5 border border-white/10 flex items-center gap-2 text-muted-foreground flex-shrink-0">
                  <SpinnerIcon className="w-4 h-4 animate-spin flex-shrink-0" />
                  <span className="text-xs">Loading episodes…</span>
                </div>
              ) : podcastEpisodes.length > 0 ? (
                <div className="mx-4 mb-4 flex-shrink-0">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 font-medium px-1">
                    <Radio className="w-3 h-3 inline mr-1.5 -mt-px" />
                    Next Episodes · {podcastEpisodes.length} remaining
                  </p>
                  <div className="space-y-1">
                    {podcastEpisodes.slice(0, 3).map((ep: any, i: number) => (
                      <button
                        key={ep.videoId || i}
                        onClick={() => {
                          const song = {
                            id:           ep.videoId,
                            title:        ep.title,
                            artist:       ep.artist || podcastTitle || "Podcast",
                            thumbnail:    ep.thumbnail || "",
                            type:         "musiva" as const,
                            videoId:      ep.videoId,
                            duration:     ep.duration || "",
                            isPodcast:    true,
                            podcastId:    podcastId || currentSong?.podcastId || "",
                            podcastTitle: podcastTitle || currentSong?.podcastTitle || "",
                          }
                          playSong(song, true)
                          router.replace(
                            `/player?id=${encodeURIComponent(ep.videoId)}&title=${encodeURIComponent(ep.title)}&artist=${encodeURIComponent(ep.artist || podcastTitle || "Podcast")}&thumbnail=${encodeURIComponent(ep.thumbnail || "")}&type=musiva&videoId=${encodeURIComponent(ep.videoId)}&isPodcast=1&podcastId=${encodeURIComponent(podcastId || currentSong?.podcastId || "")}&podcastTitle=${encodeURIComponent(podcastTitle || currentSong?.podcastTitle || "")}`
                          )
                        }}
                        className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 hover:border-primary/30 transition-all text-left group"
                      >
                        <div className="w-9 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0 relative">
                          <ImageWithFallback
                            src={ep.thumbnail}
                            alt={ep.title}
                            className="w-full h-full object-cover"
                            fallback={<div className="w-full h-full flex items-center justify-center"><Radio className="w-4 h-4 text-muted-foreground/40" /></div>}
                          />
                          <div className="absolute inset-0 bg-primary/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Play className="w-3.5 h-3.5 text-white" fill="currentColor" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate leading-tight">{ep.title}</p>
                          {ep.duration && <p className="text-[10px] text-muted-foreground mt-0.5">{ep.duration}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null
            ) : (
              /* ── Music: regular queue strip ── */
              nextPreview.length > 0 && (
                <button
                  onClick={() => { setShowQueue(true) }}
                  className="mx-4 mb-4 px-3 py-2.5 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors text-left flex-shrink-0"
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 font-medium">
                    Up Next · {remaining} song{remaining !== 1 ? "s" : ""}
                  </p>
                  <div className="flex items-center gap-2">
                    {nextPreview.map((s, i) => (
                      <ImageWithFallback
                        key={i}
                        src={s.thumbnail || "/placeholder.svg"}
                        alt={s.title}
                        className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                        fallback={
                          <img
                            src="https://via.placeholder.com/32?text=♪"
                            alt={s.title}
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                          />
                        }
                      />
                    ))}
                    {nextSong && (
                      <div className="flex-1 min-w-0 ml-1">
                        <p className="text-xs font-semibold truncate">{nextSong.title}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{nextSong.artist}</p>
                      </div>
                    )}
                  </div>
                </button>
              )
            )}
          </div>
        )}
      </div>

      {/* ── Share Dialog/Drawer ── */}
      {isDesktop ? (
        <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
          <DialogContent className="max-w-sm rounded-3xl border-border/40 bg-card/95 backdrop-blur-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <Share2 className="w-4 h-4 text-primary" />
                Share Song
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                {(currentSong?.title || title)}{(currentSong?.artist || artist) ? ` · ${currentSong?.artist || artist}` : ""}
              </DialogDescription>
            </DialogHeader>

            {/* Tab switcher */}
            <div className="flex gap-1 bg-muted/30 rounded-xl p-1 mb-1">
              {(["link", "card"] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setShareTab(t)}
                  className={[
                    "flex-1 py-1.5 rounded-lg text-xs font-medium transition-all",
                    shareTab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {t === "link" ? "🔗 Share Link" : "🎨 Share Card"}
                </button>
              ))}
            </div>

            {shareTab === "link" ? (
              <div className="space-y-3 py-1">
                {/* ── Start time ── */}
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-2xl bg-muted/30 border border-border/30 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setShareUseTimestamp(v => !v)}
                >
                  <div>
                    <p className="text-sm font-semibold">▶ Start at</p>
                    <p className="text-xs text-muted-foreground">
                      {shareUseTimestamp ? `Clip starts at ${fmt(shareTimestamp)}` : "Plays from beginning"}
                    </p>
                  </div>
                  <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${shareUseTimestamp ? "bg-primary" : "bg-muted"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${shareUseTimestamp ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </div>

                {shareUseTimestamp && (
                  <div className="px-1">
                    <Slider
                      value={[shareTimestamp]}
                      max={duration || 300}
                      step={1}
                      onValueChange={([v]) => setShareTimestamp(v)}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                      <span>0:00</span>
                      <span className="font-semibold text-primary text-sm">{fmt(shareTimestamp)}</span>
                      <span>{fmt(duration)}</span>
                    </div>
                  </div>
                )}

                {/* ── End / Stop at ── */}
                <div
                  className="flex items-center justify-between px-4 py-3 rounded-2xl bg-muted/30 border border-border/30 cursor-pointer hover:bg-muted/40 transition-colors"
                  onClick={() => setShareUseEndTimestamp(v => !v)}
                >
                  <div>
                    <p className="text-sm font-semibold">⏹ Stop at</p>
                    <p className="text-xs text-muted-foreground">
                      {shareUseEndTimestamp ? `Clip stops at ${fmt(shareEndTimestamp)}` : "Plays to the end"}
                    </p>
                  </div>
                  <div className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${shareUseEndTimestamp ? "bg-primary" : "bg-muted"}`}>
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${shareUseEndTimestamp ? "translate-x-5" : "translate-x-0.5"}`} />
                  </div>
                </div>

                {shareUseEndTimestamp && (
                  <div className="px-1">
                    <Slider
                      value={[shareEndTimestamp || Math.min((shareUseTimestamp ? shareTimestamp : 0) + 30, duration || 300)]}
                      min={shareUseTimestamp ? shareTimestamp + 1 : 1}
                      max={duration || 300}
                      step={1}
                      onValueChange={([v]) => setShareEndTimestamp(v)}
                      className="mb-2"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
                      <span>{shareUseTimestamp ? fmt(shareTimestamp) : "0:00"}</span>
                      <span className="font-semibold text-primary text-sm">{fmt(shareEndTimestamp)}</span>
                      <span>{fmt(duration)}</span>
                    </div>
                  </div>
                )}

                {/* Clip preview badge */}
                {(shareUseTimestamp || shareUseEndTimestamp) && (
                  <div className="flex items-center justify-center gap-2 py-1.5 rounded-xl bg-primary/8 border border-primary/15">
                    <span className="text-xs font-semibold text-primary tabular-nums">
                      Clip: {shareUseTimestamp ? fmt(shareTimestamp) : "0:00"}
                      {" → "}
                      {shareUseEndTimestamp ? fmt(shareEndTimestamp) : fmt(duration)}
                      {shareUseTimestamp && shareUseEndTimestamp
                        ? ` (${fmt(shareEndTimestamp - shareTimestamp)} long)`
                        : ""}
                    </span>
                  </div>
                )}

                {/* URL preview */}
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-muted/20 border border-border/20">
                  <Link className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground truncate flex-1 font-mono select-all">
                    {typeof window !== "undefined" ? buildShareUrl().replace(window.location.origin, "musicanaz.vercel.app") : ""}
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-1">
                <ShareCardGenerator
                  title={currentSong?.title || title || "Unknown"}
                  artist={currentSong?.artist || artist || "Unknown"}
                  thumbnail={currentSong?.thumbnail || thumbnail || ""}
                  lyrics={lyrics}
                  currentLyricIndex={currentLyricIndex}
                  translatedLines={aiLines}
                  translationMode={aiMode}
                />
              </div>
            )}

            {shareTab === "link" && (
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <Button
                  onClick={copyShareUrl}
                  variant="outline"
                  className="rounded-2xl flex-1 gap-2 h-11"
                >
                  {shareCopied ? <Check className="w-4 h-4 text-green-400" /> : <Link className="w-4 h-4" />}
                  {shareCopied ? "Copied!" : "Copy Link"}
                </Button>
                <Button
                  onClick={nativeShare}
                  className="rounded-2xl flex-1 gap-2 h-11"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </DialogFooter>
            )}
          </DialogContent>
        </Dialog>
      ) : (
        <Drawer open={showShareDialog} onOpenChange={setShowShareDialog} dismissible={false}>
          <DrawerContent className="border-border/40 bg-card/95 backdrop-blur-xl rounded-t-[32px] max-h-[90dvh] flex flex-col">
            <DrawerHeader className="text-left flex-shrink-0 pb-0">
              <div className="flex items-center justify-between">
                <DrawerTitle className="flex items-center gap-2 text-base">
                  <Share2 className="w-4 h-4 text-primary" />
                  Share Song
                </DrawerTitle>
                <button
                  onClick={() => setShowShareDialog(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <XIcon className="w-4 h-4" />
                </button>
              </div>
              <DrawerDescription className="text-sm text-muted-foreground mt-0.5">
                {(currentSong?.title || title)}{(currentSong?.artist || artist) ? ` · ${currentSong?.artist || artist}` : ""}
              </DrawerDescription>
            </DrawerHeader>

            {/* Tab switcher — outside scroll so always visible */}
            <div className="px-4 pt-3 flex-shrink-0">
              <div className="flex gap-1 bg-muted/30 rounded-xl p-1">
                {(["link", "card"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setShareTab(t)}
                    className={[
                      "flex-1 py-2 rounded-lg text-xs font-medium transition-all",
                      shareTab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {t === "link" ? "🔗 Share Link" : "🎨 Share Card"}
                  </button>
                ))}
              </div>
            </div>

            {/* Scrollable content — data-vaul-no-drag prevents vaul from treating scroll as dismiss */}
            <div
              data-vaul-no-drag
              className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3"
            >
              {shareTab === "link" ? (
                <div className="space-y-4 py-2">
                  {/* ── Start time ── */}
                  <div
                    className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border/30 active:scale-[0.98] transition-all"
                    onClick={() => setShareUseTimestamp(v => !v)}
                  >
                    <div>
                      <p className="text-sm font-semibold">▶ Start at</p>
                      <p className="text-xs text-muted-foreground">
                        {shareUseTimestamp ? `Clip starts at ${fmt(shareTimestamp)}` : "Plays from beginning"}
                      </p>
                    </div>
                    <div className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${shareUseTimestamp ? "bg-primary" : "bg-muted"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${shareUseTimestamp ? "translate-x-6" : "translate-x-1"}`} />
                    </div>
                  </div>

                  {shareUseTimestamp && (
                    <div className="px-1">
                      <Slider
                        value={[shareTimestamp]}
                        max={duration || 300}
                        step={1}
                        onValueChange={([v]) => setShareTimestamp(v)}
                        className="mb-3"
                      />
                      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                        <span>0:00</span>
                        <span className="font-bold text-primary text-sm">{fmt(shareTimestamp)}</span>
                        <span>{fmt(duration)}</span>
                      </div>
                    </div>
                  )}

                  {/* ── Stop at ── */}
                  <div
                    className="flex items-center justify-between p-4 rounded-2xl bg-muted/40 border border-border/30 active:scale-[0.98] transition-all"
                    onClick={() => setShareUseEndTimestamp(v => !v)}
                  >
                    <div>
                      <p className="text-sm font-semibold">⏹ Stop at</p>
                      <p className="text-xs text-muted-foreground">
                        {shareUseEndTimestamp ? `Clip stops at ${fmt(shareEndTimestamp)}` : "Plays to the end"}
                      </p>
                    </div>
                    <div className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${shareUseEndTimestamp ? "bg-primary" : "bg-muted"}`}>
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${shareUseEndTimestamp ? "translate-x-6" : "translate-x-1"}`} />
                    </div>
                  </div>

                  {shareUseEndTimestamp && (
                    <div className="px-1">
                      <Slider
                        value={[shareEndTimestamp || Math.min((shareUseTimestamp ? shareTimestamp : 0) + 30, duration || 300)]}
                        min={shareUseTimestamp ? shareTimestamp + 1 : 1}
                        max={duration || 300}
                        step={1}
                        onValueChange={([v]) => setShareEndTimestamp(v)}
                        className="mb-3"
                      />
                      <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                        <span>{shareUseTimestamp ? fmt(shareTimestamp) : "0:00"}</span>
                        <span className="font-bold text-primary text-sm">{fmt(shareEndTimestamp)}</span>
                        <span>{fmt(duration)}</span>
                      </div>
                    </div>
                  )}

                  {/* Clip preview badge */}
                  {(shareUseTimestamp || shareUseEndTimestamp) && (
                    <div className="flex items-center justify-center gap-2 py-2 rounded-xl bg-primary/8 border border-primary/15">
                      <span className="text-xs font-semibold text-primary tabular-nums">
                        Clip: {shareUseTimestamp ? fmt(shareTimestamp) : "0:00"}
                        {" → "}
                        {shareUseEndTimestamp ? fmt(shareEndTimestamp) : fmt(duration)}
                        {shareUseTimestamp && shareUseEndTimestamp
                          ? ` (${fmt(shareEndTimestamp - shareTimestamp)} long)`
                          : ""}
                      </span>
                    </div>
                  )}

                  {/* URL preview */}
                  <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/20">
                    <Link className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-muted-foreground truncate flex-1 font-mono select-all">
                      {typeof window !== "undefined" ? buildShareUrl().replace(window.location.origin, "musicanaz.vercel.app") : ""}
                    </p>
                  </div>

                  {/* Link share buttons */}
                  <div className="flex gap-3 pt-1 pb-2">
                    <Button
                      onClick={copyShareUrl}
                      variant="outline"
                      className="rounded-2xl flex-1 gap-2 h-12 text-sm font-medium"
                    >
                      {shareCopied ? <Check className="w-4 h-4 text-green-400" /> : <Link className="w-4 h-4" />}
                      {shareCopied ? "Copied" : "Copy Link"}
                    </Button>
                    <Button
                      onClick={nativeShare}
                      className="rounded-2xl flex-1 gap-2 h-12 text-sm font-medium"
                    >
                      <Share2 className="w-4 h-4" />
                      Share
                    </Button>
                  </div>
                </div>
              ) : (
                <ShareCardGenerator
                  title={currentSong?.title || title || "Unknown"}
                  artist={currentSong?.artist || artist || "Unknown"}
                  thumbnail={currentSong?.thumbnail || thumbnail || ""}
                  lyrics={lyrics}
                  currentLyricIndex={currentLyricIndex}
                  translatedLines={aiLines}
                  translationMode={aiMode}
                />
              )}
            </div>
          </DrawerContent>
        </Drawer>
      )}

      {/* ── Add to Playlist dialog ── */}
      <Dialog open={showPlaylistDlg} onOpenChange={setShowPlaylistDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Add to Playlist</DialogTitle>
            <DialogDescription>Choose a playlist or create a new one</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-52 overflow-y-auto">
            {playlists.length > 0 ? playlists.map(pl => (
              <Button key={pl.id} variant="outline" className="w-full justify-start gap-2 h-auto py-2" onClick={() => handleSelectPlaylist(pl.id)}>
                <ListPlus className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{pl.name}</span>
                <span className="text-muted-foreground ml-auto text-xs flex-shrink-0">{pl.songs.length}</span>
              </Button>
            )) : (
              <p className="text-sm text-center text-muted-foreground py-4">No playlists yet</p>
            )}
          </div>
          <DialogFooter>
            <Button className="w-full" onClick={() => { setShowPlaylistDlg(false); setShowNewPlaylistDlg(true) }}>
              + New Playlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Smart Queue Suggestion Card ── */}
      {queueExhausted && suggestions.length > 0 && (
        <div className="fixed bottom-28 left-0 right-0 z-50 px-4 pointer-events-none">
          <div className="max-w-md mx-auto bg-card/95 backdrop-blur-xl border border-border/40 rounded-3xl shadow-2xl overflow-hidden pointer-events-auto">
            <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
              <p className="font-semibold text-sm flex-1">What's next?</p>
              <button onClick={dismissSuggestions} className="text-muted-foreground/60 hover:text-foreground text-xs px-2 py-1 rounded-lg hover:bg-muted/40 transition-colors">
                Dismiss
              </button>
            </div>
            <div className="space-y-0 pb-3">
              {suggestions.slice(0, 4).map((song, i) => (
                <div
                  key={song.id}
                  onClick={() => playSong(song)}
                  className="group flex items-center gap-3 px-4 py-2.5 hover:bg-primary/5 transition-colors cursor-pointer"
                >
                  <span className="text-xs text-muted-foreground/40 w-4 text-center flex-shrink-0">{i + 1}</span>
                  <div className="relative w-9 h-9 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <ImageWithFallback
                      src={song.thumbnail} alt={song.title}
                      className="w-full h-full object-cover"
                      fallback={<div className="w-full h-full flex items-center justify-center bg-muted"><Music className="w-3 h-3 text-muted-foreground" /></div>}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                      <Play className="w-3 h-3 text-white opacity-0 group-hover:opacity-100 fill-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{song.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-4 pb-4">
              <Button
                size="sm"
                className="w-full rounded-2xl h-9 text-sm gap-2"
                onClick={() => playFromSuggestions(suggestions)}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Play All Suggestions
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Sleep Timer Dialog ── */}
      <Dialog open={showSleepTimerDlg} onOpenChange={setShowSleepTimerDlg}>
        <DialogContent className="max-w-xs rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Timer className="w-5 h-5 text-primary" />
              Sleep Timer
            </DialogTitle>
            <DialogDescription>
              Stop playback automatically.
            </DialogDescription>
          </DialogHeader>

          {/* End of song mode */}
          <button
            onClick={() => startSleepTimer(0, "song")}
            className={[
              "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all text-left",
              sleepTimerActive && sleepMode === "song"
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border/40 hover:bg-card/60",
            ].join(" ")}
          >
            <Music className="w-4 h-4 flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm">End of current song</p>
              <p className="text-xs text-muted-foreground">Stop when this song finishes</p>
            </div>
            {sleepTimerActive && sleepMode === "song" && (
              <Check className="w-4 h-4 ml-auto text-primary" />
            )}
          </button>

          <div className="grid grid-cols-3 gap-2 py-1">
            {[5, 10, 15, 20, 30, 45, 60, 90, 120].map(mins => (
              <Button
                key={mins}
                variant={sleepTimerActive && sleepMode === "timer" && sleepRemaining === mins * 60 ? "default" : "outline"}
                className="rounded-xl h-11 text-sm"
                onClick={() => startSleepTimer(mins, "timer")}
              >
                {mins < 60 ? `${mins}m` : `${mins/60}h`}
              </Button>
            ))}
          </div>

          {sleepTimerActive && (
            <div className="text-center rounded-2xl bg-primary/8 border border-primary/20 py-3 px-4">
              {sleepMode === "song" ? (
                <p className="text-sm text-primary font-medium">⏸ Stops after current song</p>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground mb-1">Stopping in</p>
                  <p className="text-2xl font-bold text-primary tabular-nums">
                    {Math.floor(sleepRemaining / 60)}:{(sleepRemaining % 60).toString().padStart(2, "0")}
                  </p>
                </>
              )}
            </div>
          )}

          <Button
            variant="destructive"
            className="w-full rounded-2xl h-11 mt-1"
            onClick={() => startSleepTimer(0)}
            disabled={!sleepTimerActive}
          >
            Turn Off Timer
          </Button>
        </DialogContent>
      </Dialog>

      {/* ── Party Mode Dialog ── */}
      <Dialog open={showPartyDlg} onOpenChange={setShowPartyDlg}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Party Mode
            </DialogTitle>
            <DialogDescription>
              Collaborate on the queue with friends!
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 flex flex-col items-center gap-4">
            {!partyId ? (
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Start a party to let others add songs to your current queue via a QR code or link.
                </p>
                <Button onClick={handleStartParty} className="rounded-full px-8">
                  Start a Party
                </Button>
              </div>
            ) : (
              <div className="w-full space-y-5">
                <div className="flex flex-col items-center gap-3">
                  <div className="bg-white p-3 rounded-2xl shadow-lg">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(getPartyUrl())}`}
                      alt="Party QR Code"
                      className="w-44 h-44"
                    />
                  </div>
                  <p className="text-xs font-medium text-primary">Scan to Join</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Join Link</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      value={getPartyUrl()}
                      className="h-10 text-xs bg-muted/50 rounded-xl"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      className="rounded-xl"
                      onClick={() => {
                        navigator.clipboard.writeText(getPartyUrl())
                        alert("Copied to clipboard!")
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <Button
                  variant="destructive"
                  className="w-full rounded-xl h-11"
                  onClick={stopParty}
                >
                  End Party
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showNewPlaylistDlg} onOpenChange={setShowNewPlaylistDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Playlist</DialogTitle>
            <DialogDescription>Give your playlist a name</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="pl-name">Name</Label>
            <Input
              id="pl-name"
              placeholder="My Playlist"
              value={newPlaylistName}
              onChange={e => setNewPlaylistName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreatePlaylist()}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNewPlaylistDlg(false)}>Cancel</Button>
            <Button onClick={handleCreatePlaylist}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function PlayerPage() {
  return (
    <Suspense fallback={
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-primary/20 via-background to-background">
        <div className="w-7 h-7 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    }>
      <PlayerContent />
    </Suspense>
  )
}
