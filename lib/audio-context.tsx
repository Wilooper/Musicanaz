"use client"

import type React from "react"
import {
  createContext, useContext, useState, useRef,
  useEffect, useCallback, type ReactNode,
} from "react"
import type { LyricLine, LyricsResponse, Song, UpNextQueue } from "./types"
import { recordListenSeconds, addToSongHistory } from "./storage"

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
  playSong:          (song: Song, isManual?: boolean, startTime?: number) => void
  // Play a user playlist as queue — no upnext fetch, uses playlist songs directly
  playPlaylist:      (songs: Song[], startIndex?: number) => void
  togglePlayPause:   () => void
  seek:              (time: number) => void
  setVolume:         (volume: number) => void
  playNext:          () => void
  playPrev:          () => void
  stopSong:          () => void
  // Queue manipulation
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
function trackToSong(t: any): Song {
  const thumb =
    t.thumbnail ||
    (Array.isArray(t.thumbnails)
      ? (typeof t.thumbnails[0] === "string" ? t.thumbnails[0] : t.thumbnails[0]?.url) || ""
      : "")
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

  // Keep refs in sync with state
  useEffect(() => { queueRef.current = queue }, [queue])
  useEffect(() => { queueIndexRef.current = queueIndex }, [queueIndex])

  // ── hidden YT container ──────────────────────────────────
  useEffect(() => {
    const div = document.createElement("div")
    div.id = "__yt_player__"
    div.style.cssText =
      "position:fixed;bottom:-9999px;left:-9999px;width:1px;height:1px;overflow:hidden;pointer-events:none;opacity:0;"
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

  // ── poll YT time ─────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      const p = ytPlayerRef.current
      if (!p || typeof p.getCurrentTime !== "function") return
      try { const ct = p.getCurrentTime(); setCurrentTime(ct); syncLyrics(ct) } catch {}
    }, 500)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [syncLyrics])

  // ── sync volume ─────────────────────────────────────────
  useEffect(() => {
    const p = ytPlayerRef.current
    if (!p || typeof p.setVolume !== "function") return
    try { p.setVolume(volume) } catch {}
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
            } else if (e.data === S.PAUSED) {
              setIsPlaying(false)
            } else if (e.data === S.BUFFERING) {
              setIsPlaying(true)
            } else if (e.data === S.ENDED) {
              setIsPlaying(false)
              setCurrentTime(0)
              // ─── Auto-advance through the EXISTING queue ───────────────
              // Read directly from refs — no setState needed, no stale closure
              const currentIdx = queueIndexRef.current
              const currentQueue = queueRef.current
              const nextIdx = currentIdx + 1
              if (nextIdx < currentQueue.length) {
                const nextSong = currentQueue[nextIdx]
                queueIndexRef.current = nextIdx
                setQueueIndex(nextIdx)
                // Small timeout to let state settle
                setTimeout(() => _advanceToSong(nextSong), 50)
              }
              // If end of queue, just stop — don't fetch a new queue
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
      // ⬆ NO fetchUpNext here — queue stays intact
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
  const playSong = useCallback((song: Song, isManual = true, startTime = 0) => {
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
      playNext, playPrev, stopSong,
      removeFromQueue, moveInQueue,
      audioRef, ytPlayerRef,
      partyId, isPartyHost, startParty, stopParty, joinParty, addToPartyQueue,
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
