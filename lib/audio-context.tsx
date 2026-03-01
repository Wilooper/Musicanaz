"use client"

import type React from "react"
import {
  createContext, useContext, useState, useRef,
  useEffect, useCallback, type ReactNode,
} from "react"
import type { LyricLine, LyricsResponse, Song, UpNextQueue } from "./types"
import { recordListenSeconds, addToSongHistory, recordBadgeEvent } from "./storage"

const LYRICS_API = "https://test-0k.onrender.com"

interface AudioContextType {
  currentSong:       Song | null
  isPlaying:         boolean
  currentTime:       number
  duration:          number
  volume:            number
  lyrics:            LyricLine[]
  lyricsLoading:     boolean
  lyricsNotFound:    boolean
  currentLyricIndex: number
  queue:             Song[]
  queueIndex:        number
  isCached:          boolean
  isLoading:         boolean
  playSong:          (song: Song, isManual?: boolean, startTime?: number, stopAt?: number) => void
  playPlaylist:      (songs: Song[], startIndex?: number) => void
  togglePlayPause:   () => void
  seek:              (time: number) => void
  setVolume:         (volume: number) => void
  playNext:          () => void
  playPrev:          () => void
  stopSong:          () => void
  removeFromQueue:   (index: number) => void
  moveInQueue:       (fromIndex: number, toIndex: number) => void
  audioRef:          React.RefObject<HTMLAudioElement>
  ytPlayerRef:       React.MutableRefObject<any>
  // Party Mode
  partyId:           string | null
  isPartyHost:       boolean
  startParty:        () => Promise<string | null>
  stopParty:         () => void
  joinParty:         (id: string) => void
  addToPartyQueue:   (song: Song) => Promise<boolean>
  // Smart Queue Suggestions
  queueExhausted:    boolean
  suggestions:       Song[]
  dismissSuggestions: () => void
  playFromSuggestions:(songs: Song[]) => void
  // Crossfade
  crossfadeSecs:     number
  setCrossfadeSecs:  (secs: number) => void
  // Shared clip stop-at
  stopAtTime:        number
  setStopAtTime:     (t: number) => void
}

const AudioCtx = createContext<AudioContextType | undefined>(undefined)

// ─── YT IFrame API loader ──────────────────────────────────
let ytApiReady = false
const ytReadyCbs: Array<() => void> = []

function loadYTApi(): Promise<void> {
  return new Promise((resolve) => {
    if (ytApiReady) { resolve(); return }
    ytReadyCbs.push(resolve)
    if (!(window as any)._ytApiLoading) {
      ;(window as any)._ytApiLoading = true
      const s = document.createElement("script")
      s.src = "https://www.youtube.com/iframe_api"
      document.head.appendChild(s)
      ;(window as any).onYouTubeIframeAPIReady = () => {
        ytApiReady = true
        ytReadyCbs.forEach(cb => cb())
        ytReadyCbs.length = 0
      }
    }
  })
}

// ─── helpers ──────────────────────────────────────────────
// Quality rank for YouTube thumbnail URLs (higher = better)
function ytQuality(url: string): number {
  if (!url) return 0
  if (url.includes("maxresdefault")) return 7
  if (url.includes("sddefault"))    return 6
  if (url.includes("hqdefault"))    return 5
  if (url.includes("mqdefault"))    return 4
  if (url.includes("0.jpg") || url.includes("0.webp")) return 3
  if (url.includes("default"))      return 2
  return 1
}

function bestThumb(thumbnails: any, fallback = ""): string {
  if (!Array.isArray(thumbnails) || !thumbnails.length) return fallback
  const sorted = [...thumbnails].sort((a, b) => {
    const aw = typeof a === "string" ? 0 : (a?.width || 0)
    const bw = typeof b === "string" ? 0 : (b?.width || 0)
    if (bw !== aw) return bw - aw
    const aUrl = typeof a === "string" ? a : (a?.url || "")
    const bUrl = typeof b === "string" ? b : (b?.url || "")
    return ytQuality(bUrl) - ytQuality(aUrl)
  })
  const t = sorted[0]
  return (typeof t === "string" ? t : (t?.url || "")) || fallback
}

function trackToSong(t: any): Song {
  const thumb = bestThumb(t.thumbnails, t.thumbnail || "")
  const artist = Array.isArray(t.artists)
    ? t.artists.map((a: any) => (typeof a === "string" ? a : a?.name || "")).join(", ")
    : String(t.artists || t.artist || "Unknown")
  return {
    id:        t.videoId || "",
    title:     t.title   || "Unknown",
    artist,
    thumbnail: thumb,
    type:      "musiva",
    videoId:   t.videoId || "",
    duration:  t.duration || "",
    album:     typeof t.album === "string" ? t.album : t.album?.name || "",
  }
}

// ─── provider ─────────────────────────────────────────────
export function AudioProvider({ children }: { children: ReactNode }) {
  const audioRef       = useRef<HTMLAudioElement>(null)
  const ytPlayerRef    = useRef<any>(null)
  const ytContainerRef = useRef<HTMLDivElement | null>(null)
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const volumeRef      = useRef(80)
  const isLoadingRef   = useRef(false)

  // The video_id that OWNS the current queue.
  // This NEVER changes when navigating through the queue automatically.
  // It ONLY changes when the user manually picks a brand-new song.
  const queueOwnerRef  = useRef<string | null>(null)

  // Stable refs for queue state so callbacks always see latest values
  // without needing them as deps (prevents stale closures)
  const queueRef       = useRef<Song[]>([])
  const queueIndexRef  = useRef<number>(-1)

  const [currentSong,       setCurrentSong]       = useState<Song | null>(null)
  const [isPlaying,         setIsPlaying]         = useState(false)
  const [currentTime,       setCurrentTime]       = useState(0)
  const [duration,          setDuration]          = useState(0)
  const [volume,            setVolumeState]       = useState(80)
  const [lyrics,            setLyrics]            = useState<LyricLine[]>([])
  const [lyricsLoading,     setLyricsLoading]     = useState(false)
  const [lyricsNotFound,    setLyricsNotFound]    = useState(false)
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1)
  const [queue,             setQueue]             = useState<Song[]>([])
  const [queueIndex,        setQueueIndex]        = useState(-1)
  const [isCached,          setIsCached]          = useState(false)
  const [isLoading,         setIsLoading]         = useState(false)

  // Party Mode State
  const [partyId,           setPartyId]           = useState<string | null>(null)
  const [isPartyHost,       setIsPartyHost]       = useState(false)
  const partyIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const listenTickRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  // Smart Queue Suggestions
  const [queueExhausted, setQueueExhausted] = useState(false)
  const [suggestions,    setSuggestions]    = useState<Song[]>([])

  // Crossfade
  const [crossfadeSecs, setCrossfadeSecsState] = useState(0)
  const crossfadeSecsRef  = useRef(0)

  // Stop-at time for shared clips (0 = disabled)
  const [stopAtTime,    setStopAtTimeState] = useState(0)
  const stopAtTimeRef   = useRef(0)
  // Pending stop-at: set before song loads, applied the moment PLAYING fires
  const pendingStopAtRef = useRef(0)
  const fadeMultiplierRef = useRef(1)   // 1.0 = full, 0.0 = silent
  const fadingOutRef      = useRef(false)
  const fadingInRef       = useRef(false)
  const fadeInTimerRef    = useRef<ReturnType<typeof setInterval> | null>(null)

  // Keep refs in sync with state
  useEffect(() => { queueRef.current = queue }, [queue])
  useEffect(() => { queueIndexRef.current = queueIndex }, [queueIndex])

  // Load crossfade setting from prefs on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const { getPreferences } = require("./storage")
      const prefs = getPreferences()
      const secs  = prefs.crossfadeSecs ?? 0
      setCrossfadeSecsState(secs)
      crossfadeSecsRef.current = secs
    } catch {}
  }, [])

  // ── hidden YT container ──────────────────────────────────
  useEffect(() => {
    const div = document.createElement("div")
    div.id = "__yt_player__"
    div.style.cssText =
      "position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;"
    // aria-hidden prevents screen readers and Android media detection from treating
    // the hidden iframe as a video element and showing video playback controls
    div.setAttribute("aria-hidden", "true")
    div.setAttribute("role", "presentation")
    document.body.appendChild(div)
    ytContainerRef.current = div
    return () => { div.remove(); ytContainerRef.current = null }
  }, [])

  // ── lyric sync ──────────────────────────────────────────
  const syncLyrics = useCallback((sec: number) => {
    if (!lyrics.length) return
    const ms = sec * 1000
    let idx = -1
    for (let i = 0; i < lyrics.length; i++) {
      if (ms >= lyrics[i].start_time && ms <= lyrics[i].end_time) { idx = i; break }
      if (ms > lyrics[i].end_time && (i === lyrics.length - 1 || ms < lyrics[i + 1].start_time)) { idx = i; break }
    }
    if (idx === -1) {
      for (let i = lyrics.length - 1; i >= 0; i--) {
        if (ms >= lyrics[i].start_time) { idx = i; break }
      }
    }
    setCurrentLyricIndex(p => p !== idx ? idx : p)
  }, [lyrics])

  // ── poll YT time — also drives crossfade ─────────────────
  const currentSongRef = useRef<Song | null>(null)
  useEffect(() => { currentSongRef.current = currentSong }, [currentSong])
  const durationRef = useRef(0)
  useEffect(() => { durationRef.current = duration }, [duration])

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      const p = ytPlayerRef.current
      if (!p || typeof p.getCurrentTime !== "function") return
      try {
        const ct  = p.getCurrentTime()
        const dur = durationRef.current
        setCurrentTime(ct)
        syncLyrics(ct)

        // ── Update Media Session position (keeps Android scrubber accurate) ──
        if (typeof navigator !== "undefined" &&
            "mediaSession" in navigator &&
            typeof navigator.mediaSession.setPositionState === "function" &&
            dur > 0 && ct > 0) {
          try {
            navigator.mediaSession.setPositionState({
              duration:     dur,
              playbackRate: 1,
              position:     Math.min(ct, dur),
            })
          } catch {}
        }

        // ── Stop-at clip enforcement ────────────────────────
        const sat = stopAtTimeRef.current
        if (sat > 0 && ct >= sat) {
          try { p.pauseVideo() } catch {}
          stopAtTimeRef.current = 0
          setStopAtTimeState(0)
        }

        // ── Crossfade fade-out ──────────────────────────────
        const cf = crossfadeSecsRef.current
        if (cf > 0 && dur > 0 && ct > 0 && !fadingOutRef.current) {
          const remaining = dur - ct
          if (remaining <= cf && remaining > 0) {
            fadingOutRef.current = true
            // Ramp volume down to 0 over `cf` seconds (tick every 200ms)
            const steps   = (remaining / 0.2)
            const decrement = (volumeRef.current / steps)
            let   curVol    = volumeRef.current
            const fadeTimer = setInterval(() => {
              curVol = Math.max(0, curVol - decrement)
              if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === "function") {
                try { ytPlayerRef.current.setVolume(curVol) } catch {}
              }
              if (curVol <= 0) clearInterval(fadeTimer)
            }, 200)
          }
        }
      } catch {}
    }, 500)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [syncLyrics])

  // ── Media Session API — lock screen / notification controls ─
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return
    if (!currentSong) return
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title:  currentSong.title,
        artist: currentSong.artist,
        album:  (currentSong as any).album || "Musicanaz",
        artwork: currentSong.thumbnail ? [
          { src: `https://images.weserv.nl/?url=${encodeURIComponent(currentSong.thumbnail)}&w=512&h=512&output=jpg`, sizes: "512x512", type: "image/jpeg" },
          { src: `https://images.weserv.nl/?url=${encodeURIComponent(currentSong.thumbnail)}&w=256&h=256&output=jpg`, sizes: "256x256", type: "image/jpeg" },
          { src: `https://images.weserv.nl/?url=${encodeURIComponent(currentSong.thumbnail)}&w=96&h=96&output=jpg`,   sizes: "96x96",   type: "image/jpeg" },
        ] : [],
      })
      navigator.mediaSession.playbackState = isPlaying ? "playing" : "paused"
      // setPositionState tells Android this is music (not video) and provides
      // the scrubber in the notification. Without this Chrome shows video controls.
      if (typeof navigator.mediaSession.setPositionState === "function") {
        try {
          const dur = durationRef.current
          const ct  = ytPlayerRef.current?.getCurrentTime?.() ?? 0
          if (dur > 0) {
            navigator.mediaSession.setPositionState({
              duration:     dur,
              playbackRate: 1,
              position:     Math.min(ct, dur),
            })
          }
        } catch {}
      }
    } catch {}
  }, [currentSong, isPlaying])

  // Register Media Session action handlers once
  useEffect(() => {
    if (typeof navigator === "undefined" || !("mediaSession" in navigator)) return
    // Only register music-appropriate handlers.
    // seekforward/seekbackward are omitted intentionally: they cause Android Chrome
    // to show video-style 10s seek buttons instead of music prev/next controls.
    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play",          () => { const p = ytPlayerRef.current; if (p) try { p.playVideo() } catch {} }],
      ["pause",         () => { const p = ytPlayerRef.current; if (p) try { p.pauseVideo() } catch {} }],
      ["nexttrack",     () => { playNext() }],
      ["previoustrack", () => { playPrev() }],
      ["seekto",        (d) => { if (d.seekTime != null) seek(d.seekTime) }],
    ]
    for (const [action, handler] of handlers) {
      try { navigator.mediaSession.setActionHandler(action, handler) } catch {}
    }
    // Explicitly null-out the video-style handlers so Android Chrome removes them
    for (const action of ["seekforward", "seekbackward"] as MediaSessionAction[]) {
      try { navigator.mediaSession.setActionHandler(action, null) } catch {}
    }
    return () => {
      for (const [action] of handlers) {
        try { navigator.mediaSession.setActionHandler(action, null) } catch {}
      }
    }
  }, []) // eslint-disable-line

  // ── sync volume ─────────────────────────────────────────
  useEffect(() => {
    const p = ytPlayerRef.current
    if (!p || typeof p.setVolume !== "function") return
    try { p.setVolume(volume) } catch {}
    // Badge: track max-volume sessions
    if (volume >= 100 && typeof window !== "undefined") {
      (window as any).__musicana_vol_max = true
    }
  }, [volume])

  // ── listen time tracker — records 5s every 5s while playing ─
  useEffect(() => {
    if (isPlaying) {
      listenTickRef.current = setInterval(() => recordListenSeconds(5), 5000)
    } else {
      if (listenTickRef.current) { clearInterval(listenTickRef.current); listenTickRef.current = null }
    }
    return () => { if (listenTickRef.current) { clearInterval(listenTickRef.current); listenTickRef.current = null } }
  }, [isPlaying])

  // ── load lyrics ─────────────────────────────────────────
  const loadLyrics = async (song: Song) => {
    setLyrics([])
    setLyricsNotFound(false)
    setLyricsLoading(true)
    const TIMEOUT_MS = 45000 // 45 seconds loading window
    const controller = new AbortController()
    const timer = setTimeout(() => {
      controller.abort()
      setLyricsLoading(false)
      setLyricsNotFound(true)
    }, TIMEOUT_MS)
    try {
      const name = song.title.split(/[-–([–—]/)[0].trim()
      const res  = await fetch(
        `${LYRICS_API}/lyrics/?artist=${encodeURIComponent(song.artist)}&song=${encodeURIComponent(name)}&timestamps=true`,
        { signal: controller.signal }
      )
      clearTimeout(timer)
      const data: LyricsResponse = await res.json()
      if (data.status === "success" && data.data?.timed_lyrics?.length) {
        setLyrics(data.data.timed_lyrics)
        setLyricsNotFound(false)
      } else {
        setLyrics([])
        setLyricsNotFound(true)
      }
    } catch {
      clearTimeout(timer)
      setLyrics([])
      setLyricsNotFound(true)
    } finally {
      setLyricsLoading(false)
    }
  }


  // ── fetch upnext ─────────────────────────────────────────
  // ONLY called for manual song selections. Never for queue advances.
  const fetchUpNext = useCallback(async (videoId: string) => {
    try {
      const res  = await fetch(`/api/musiva/upnext?videoId=${encodeURIComponent(videoId)}&forceRefresh=true`)
      const data: UpNextQueue = await res.json()
      if (data.tracks?.length) {
        const songs = data.tracks.map(trackToSong).filter(s => s.id)
        queueRef.current    = songs
        queueIndexRef.current = -1
        setQueue(songs)
        setQueueIndex(-1)
        queueOwnerRef.current = videoId
      }
    } catch {}
  }, [])

  // ── create/update YT player ──────────────────────────────
  const loadVideo = useCallback((videoId: string, startTime = 0): Promise<void> => {
    return new Promise((resolve) => {
      const container = ytContainerRef.current
      if (!container) { resolve(); return }

      if (ytPlayerRef.current && typeof ytPlayerRef.current.loadVideoById === "function") {
        try {
          ytPlayerRef.current.loadVideoById({ videoId, startSeconds: startTime })
          ytPlayerRef.current.setVolume(volumeRef.current)
          resolve()
          return
        } catch {}
      }

      container.innerHTML = ""
      const div = document.createElement("div")
      container.appendChild(div)

      // Capture refs at creation time for the onStateChange closure
      ytPlayerRef.current = new (window as any).YT.Player(div, {
        width: "1", height: "1",
        videoId,
        playerVars: {
          autoplay: 1, controls: 0, disablekb: 1,
          fs: 0, iv_load_policy: 3, modestbranding: 1,
          rel: 0, showinfo: 0, playsinline: 1,
          start: startTime,
          // These help Android Chrome identify this as background audio, not video
          origin: typeof window !== "undefined" ? window.location.origin : "",
          widget_referrer: typeof window !== "undefined" ? window.location.origin : "",
        },
        events: {
          onReady: (e: any) => {
            e.target.setVolume(volumeRef.current)
            e.target.playVideo()
            const dur = e.target.getDuration()
            if (dur) setDuration(dur)
            setIsCached(true)
            resolve()
          },
          onStateChange: (e: any) => {
            const S = (window as any).YT?.PlayerState
            if (!S) return
            if (e.data === S.PLAYING) {
              setIsPlaying(true)
              const dur = e.target.getDuration()
              if (dur) setDuration(dur)
              // Apply any pending stop-at the moment playback actually starts.
              // This is the reliable hook — avoids race conditions with timeouts.
              if (pendingStopAtRef.current > 0) {
                stopAtTimeRef.current = pendingStopAtRef.current
                setStopAtTimeState(pendingStopAtRef.current)
                pendingStopAtRef.current = 0
              }
            } else if (e.data === S.PAUSED) {
              setIsPlaying(false)
            } else if (e.data === S.BUFFERING) {
              setIsPlaying(true)
            } else if (e.data === S.ENDED) {
              setIsPlaying(false)
              setCurrentTime(0)
              fadingOutRef.current = false
              // Badge: track song completion for no-skip streak
              recordBadgeEvent("song_complete")
              // Volume max badge: check if at max
              if (typeof window !== "undefined" && (window as any).__musicana_vol_max) {
                recordBadgeEvent("volume_max")
                ;(window as any).__musicana_vol_max = false
              }
              // Restore volume for next song
              if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === "function") {
                try { ytPlayerRef.current.setVolume(volumeRef.current) } catch {}
              }
              // ─── Auto-advance through the EXISTING queue ───────────────
              const currentIdx   = queueIndexRef.current
              const currentQueue = queueRef.current
              const nextIdx      = currentIdx + 1
              if (nextIdx < currentQueue.length) {
                const nextSong = currentQueue[nextIdx]
                queueIndexRef.current = nextIdx
                setQueueIndex(nextIdx)
                setTimeout(() => _advanceToSong(nextSong), 50)
              } else {
                // Queue exhausted — fetch suggestions
                const curSong = currentSongRef.current
                if (curSong) {
                  const vid = curSong.videoId || curSong.id
                  fetch(`/api/musiva/upnext?videoId=${encodeURIComponent(vid)}`)
                    .then(r => r.json())
                    .then(data => {
                      if (data.tracks?.length) {
                        const songs = data.tracks.slice(0, 5).map((t: any) => ({
                          id: t.videoId || "", title: t.title || "Unknown",
                          artist: Array.isArray(t.artists)
                            ? t.artists.map((a: any) => typeof a === "string" ? a : a?.name || "").join(", ")
                            : String(t.artists || t.artist || "Unknown"),
                          thumbnail: t.thumbnail || (Array.isArray(t.thumbnails) ? (typeof t.thumbnails[0] === "string" ? t.thumbnails[0] : t.thumbnails[0]?.url) || "" : ""),
                          type: "musiva" as const, videoId: t.videoId || "",
                          duration: t.duration || "", album: typeof t.album === "string" ? t.album : t.album?.name || "",
                        })).filter((s: any) => s.id)
                        setSuggestions(songs)
                        setQueueExhausted(true)
                      }
                    })
                    .catch(() => {})
                }
              }
            }
          },
          onError: () => {
            setIsPlaying(false)
            isLoadingRef.current = false
            setIsLoading(false)
            resolve()
          },
        },
      })
    })
  }, []) // no deps — uses refs only

  // ── advance within existing queue (no new fetch) ─────────
  // This is the internal function used by auto-advance and skip buttons.
  // It NEVER fetches a new upnext queue.
  const _advanceToSong = useCallback(async (song: Song, startTime = 0) => {
    if (isLoadingRef.current) return
    isLoadingRef.current = true
    // Clear any pending clip stop-at when manually changing track
    stopAtTimeRef.current = 0
    setStopAtTimeState(0)
    pendingStopAtRef.current = 0
    setQueueExhausted(false)
    setSuggestions([])
    try {
      setIsLoading(true)
      setIsCached(false)
      setCurrentTime(startTime)
      setDuration(0)
      setCurrentSong(song)
      setLyrics([])
      setLyricsNotFound(false)
      setLyricsLoading(false)
      setCurrentLyricIndex(-1)
      if (!song.isPodcast) loadLyrics(song)
      addToSongHistory(song)
      const videoId = song.videoId || song.id
      await loadYTApi()
      await loadVideo(videoId, startTime)

      // Crossfade fade-in: start at 0 then ramp up
      const cf = crossfadeSecsRef.current
      if (cf > 0) {
        fadingInRef.current = true
        if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === "function") {
          try { ytPlayerRef.current.setVolume(0) } catch {}
        }
        let curVol = 0
        const target = volumeRef.current
        const steps  = (cf / 0.2)
        const inc    = target / steps
        if (fadeInTimerRef.current) clearInterval(fadeInTimerRef.current)
        fadeInTimerRef.current = setInterval(() => {
          curVol = Math.min(target, curVol + inc)
          if (ytPlayerRef.current && typeof ytPlayerRef.current.setVolume === "function") {
            try { ytPlayerRef.current.setVolume(curVol) } catch {}
          }
          if (curVol >= target) {
            clearInterval(fadeInTimerRef.current!)
            fadeInTimerRef.current = null
            fadingInRef.current = false
          }
        }, 200)
      }
    } catch (err) {
      console.error("[AudioProvider] advance error:", err)
      setIsPlaying(false)
    } finally {
      isLoadingRef.current = false
      setIsLoading(false)
    }
  }, [loadVideo])

  // ── manual play (user explicitly picks a song) ────────────
  // This resets the queue and fetches a new upnext for the new song.
  const _manualPlay = useCallback(async (song: Song, startTime = 0) => {
    if (isLoadingRef.current) return
    isLoadingRef.current = true
    try {
      setIsLoading(true)
      setIsCached(false)
      setCurrentTime(startTime)
      setDuration(0)
      setCurrentSong(song)
      setLyrics([])
      setLyricsNotFound(false)
      setLyricsLoading(false)
      setCurrentLyricIndex(-1)
      // Reset queue state immediately
      queueRef.current      = []
      queueIndexRef.current = -1
      setQueue([])
      setQueueIndex(-1)
      queueOwnerRef.current = null

      if (!song.isPodcast) loadLyrics(song)

      addToSongHistory(song)
      // Badge events: session start + genre tracking
      const nowH = new Date().getHours()
      recordBadgeEvent("session_start")
      if ((song as any).genre) recordBadgeEvent("genre_play", (song as any).genre)
      if (typeof window !== "undefined" && (window as any).__musicana_noskip_count === undefined) {
        (window as any).__musicana_noskip_count = 0
      }
      const videoId = song.videoId || song.id
      await loadYTApi()
      await loadVideo(videoId, startTime)

      // Podcasts: never build a music upnext queue — episodes handled by player UI
      if (!song.isPodcast) {
        fetchUpNext(videoId)
      }
    } catch (err) {
      console.error("[AudioProvider] manual play error:", err)
      setIsPlaying(false)
    } finally {
      isLoadingRef.current = false
      setIsLoading(false)
    }
  }, [loadVideo, fetchUpNext])

  // ── public API ───────────────────────────────────────────
  const playSong = useCallback((song: Song, isManual = true, startTime = 0, stopAt = 0) => {
    // Store stopAt in the pending ref — it will be applied the moment PLAYING fires
    if (stopAt > 0 && stopAt > startTime) {
      pendingStopAtRef.current = stopAt
    } else {
      pendingStopAtRef.current = 0
    }
    if (isManual) {
      _manualPlay(song, startTime)
    } else {
      // Queue advance — find the song in the queue and advance to it
      // without resetting or re-fetching
      const idx = queueRef.current.findIndex(s => s.id === song.id)
      if (idx >= 0) {
        queueIndexRef.current = idx
        setQueueIndex(idx)
      }
      _advanceToSong(song, startTime)
    }
  }, [_manualPlay, _advanceToSong])

  const playNext = useCallback(() => {
    const q   = queueRef.current
    const idx = queueIndexRef.current
    const nextIdx = idx + 1
    if (nextIdx < q.length) {
      recordBadgeEvent("skip")  // resets no-skip counter
      queueIndexRef.current = nextIdx
      setQueueIndex(nextIdx)
      _advanceToSong(q[nextIdx])
    }
  }, [_advanceToSong])

  const playPrev = useCallback(() => {
    const p = ytPlayerRef.current
    // If more than 3s in, restart current song
    if (p && typeof p.getCurrentTime === "function") {
      try { if (p.getCurrentTime() > 3) { p.seekTo(0, true); return } } catch {}
    }
    const q   = queueRef.current
    const idx = queueIndexRef.current
    const prevIdx = idx - 1
    if (prevIdx >= 0) {
      queueIndexRef.current = prevIdx
      setQueueIndex(prevIdx)
      _advanceToSong(q[prevIdx])
    } else {
      // Restart current
      if (p && typeof p.seekTo === "function") try { p.seekTo(0, true) } catch {}
    }
  }, [_advanceToSong])

  const togglePlayPause = useCallback(async () => {
    const p = ytPlayerRef.current
    if (!p || isLoadingRef.current) return
    try { if (isPlaying) p.pauseVideo(); else p.playVideo() } catch {}
  }, [isPlaying])

  const seek = useCallback((time: number) => {
    const p = ytPlayerRef.current
    if (p && typeof p.seekTo === "function") {
      try { p.seekTo(time, true); setCurrentTime(time) } catch {}
    }
  }, [])

  // ── Party Mode Logic ────────────────────────────────────
  const startParty = useCallback(async () => {
    try {
      const res = await fetch("https://jsonblob.com/api/jsonBlob", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ songs: [] })
      })
      const location = res.headers.get("Location")
      if (!location) return null
      const id = location.split("/").pop() || null
      if (id) {
        setPartyId(id)
        setIsPartyHost(true)
        return id
      }
    } catch (err) {
      console.error("Failed to start party:", err)
    }
    return null
  }, [])

  const stopParty = useCallback(() => {
    setPartyId(null)
    setIsPartyHost(false)
    if (partyIntervalRef.current) clearInterval(partyIntervalRef.current)
  }, [])

  const joinParty = useCallback((id: string) => {
    setPartyId(id)
    setIsPartyHost(false)
  }, [])

  const addToPartyQueue = useCallback(async (song: Song) => {
    if (!partyId) return false
    try {
      const res = await fetch(`https://jsonblob.com/api/jsonBlob/${partyId}`)
      const data = await res.json()
      data.songs.push(song)
      await fetch(`https://jsonblob.com/api/jsonBlob/${partyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })
      return true
    } catch (err) {
      console.error("Failed to add to party queue:", err)
      return false
    }
  }, [partyId])

  useEffect(() => {
    if (isPartyHost && partyId) {
      partyIntervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`https://jsonblob.com/api/jsonBlob/${partyId}`)
          const data = await res.json()
          if (data.songs && data.songs.length > 0) {
            // Add new songs to local queue
            data.songs.forEach((s: Song) => {
              setQueue(prev => {
                if (prev.some(x => x.id === s.id)) return prev
                const next = [...prev, s]
                queueRef.current = next
                return next
              })
            })
            // Clear the blob queue
            await fetch(`https://jsonblob.com/api/jsonBlob/${partyId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ songs: [] })
            })
          }
        } catch {}
      }, 5000)
    }
    return () => { if (partyIntervalRef.current) clearInterval(partyIntervalRef.current) }
  }, [isPartyHost, partyId])

  const setVolume = useCallback((vol: number) => {
    volumeRef.current = vol
    setVolumeState(vol)
    const p = ytPlayerRef.current
    if (p && typeof p.setVolume === "function") {
      try {
        if (vol === 0) p.mute()
        else { p.unMute(); p.setVolume(vol) }
      } catch {}
    }
  }, [])

  const dismissSuggestions = useCallback(() => {
    setQueueExhausted(false)
    setSuggestions([])
  }, [])

  const playFromSuggestions = useCallback((songs: Song[]) => {
    setQueueExhausted(false)
    setSuggestions([])
    if (songs.length > 0) playPlaylist(songs, 0)
  }, []) // eslint-disable-line

  const setCrossfadeSecs = useCallback((secs: number) => {
    crossfadeSecsRef.current = secs
    setCrossfadeSecsState(secs)
    try {
      const { savePreferences } = require("./storage")
      savePreferences({ crossfadeSecs: secs })
    } catch {}
  }, [])

  const setStopAtTime = useCallback((t: number) => {
    setStopAtTimeState(t)
    stopAtTimeRef.current = t
  }, [])

  const stopSong = useCallback(() => {
    const p = ytPlayerRef.current
    if (p && typeof p.stopVideo === "function") try { p.stopVideo() } catch {}
    setCurrentSong(null)
    setIsPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setLyrics([])
    setCurrentLyricIndex(-1)
    queueRef.current      = []
    queueIndexRef.current = -1
    setQueue([])
    setQueueIndex(-1)
    setIsCached(false)
    queueOwnerRef.current = null
  }, [])

  // ── play a user playlist as queue (no upnext fetch) ────────
  const playPlaylist = useCallback((songs: Song[], startIndex = 0) => {
    if (!songs.length) return
    const validSongs = songs.filter(s => s.videoId || s.id)
    if (!validSongs.length) return
    // Inject playlist directly as queue, no server fetch
    queueRef.current      = validSongs
    queueIndexRef.current = startIndex
    setQueue(validSongs)
    setQueueIndex(startIndex)
    queueOwnerRef.current = "playlist__" + Date.now()
    // Play the start song
    _manualPlayWithQueue(validSongs[startIndex], validSongs, startIndex)
  }, []) // eslint-disable-line

  const _manualPlayWithQueue = useCallback(async (song: Song, songs: Song[], idx: number) => {
    if (isLoadingRef.current) return
    isLoadingRef.current = true
    try {
      setIsLoading(true)
      setIsCached(false)
      setCurrentTime(0)
      setDuration(0)
      setCurrentSong(song)
      setLyrics([])
      setCurrentLyricIndex(-1)
      queueRef.current      = songs
      queueIndexRef.current = idx
      setQueue(songs)
      setQueueIndex(idx)
      loadLyrics(song)
      const videoId = song.videoId || song.id
      await loadYTApi()
      await loadVideo(videoId)
      // No fetchUpNext — queue IS the playlist
    } catch (err) {
      console.error("[AudioProvider] playlist play error:", err)
      setIsPlaying(false)
    } finally {
      isLoadingRef.current = false
      setIsLoading(false)
    }
  }, [loadVideo])

  // ── queue manipulation ────────────────────────────────────
  const removeFromQueue = useCallback((index: number) => {
    setQueue(prev => {
      const next = prev.filter((_, i) => i !== index)
      queueRef.current = next
      // Adjust queueIndex if needed
      setQueueIndex(prevIdx => {
        let newIdx = prevIdx
        if (index < prevIdx) newIdx = prevIdx - 1
        else if (index === prevIdx) newIdx = Math.min(prevIdx, next.length - 1)
        queueIndexRef.current = newIdx
        return newIdx
      })
      return next
    })
  }, [])

  const moveInQueue = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return
    setQueue(prev => {
      const next = [...prev]
      const [item] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, item)
      queueRef.current = next
      // Keep queueIndex tracking the same song
      setQueueIndex(prevIdx => {
        let newIdx = prevIdx
        if (prevIdx === fromIndex) {
          newIdx = toIndex
        } else if (fromIndex < prevIdx && toIndex >= prevIdx) {
          newIdx = prevIdx - 1
        } else if (fromIndex > prevIdx && toIndex <= prevIdx) {
          newIdx = prevIdx + 1
        }
        queueIndexRef.current = newIdx
        return newIdx
      })
      return next
    })
  }, [])

    return (
    <AudioCtx.Provider value={{
      currentSong, isPlaying, currentTime, duration, volume,
      lyrics, lyricsLoading, lyricsNotFound, currentLyricIndex, queue, queueIndex,
      isCached, isLoading,
      playSong, playPlaylist, togglePlayPause, seek, setVolume,
      playNext, playPrev, stopSong, stopAtTime, setStopAtTime,
      removeFromQueue, moveInQueue,
      audioRef, ytPlayerRef,
      partyId, isPartyHost, startParty, stopParty, joinParty, addToPartyQueue,
      queueExhausted, suggestions, dismissSuggestions, playFromSuggestions,
      crossfadeSecs, setCrossfadeSecs,
    }}>
      {children}
      <audio ref={audioRef} style={{ display: "none" }} />
    </AudioCtx.Provider>
  )
}

export function useAudio() {
  const ctx = useContext(AudioCtx)
  if (!ctx) throw new Error("useAudio must be used within an AudioProvider")
  return ctx
}
