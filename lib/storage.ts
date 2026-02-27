import type { Song } from "./types"

const STORAGE_KEY = "lyrica_recently_played"
const LIKED_KEY = "lyrica_liked_songs"
const CACHED_KEY = "lyrica_cached_songs"
const PLAYLISTS_KEY = "lyrica_playlists"
const DOWNLOADED_KEY = "lyrica_downloaded_songs"
const MAX_RECENT_SONGS = 12
const MAX_CACHED_SONGS = 20

export interface Playlist {
  id: string
  name: string
  description?: string
  songs: Song[]
  createdAt: number
  updatedAt: number
}

export interface CachedSong extends Song {
  audioUrl: string
  audioBlob?: string
  cachedAt: number
}

export interface DownloadedSong extends CachedSong {
  downloadedAt: number
}

// Recently Played
export function getRecentlyPlayed(): Song[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function addToRecentlyPlayed(song: Song): void {
  if (typeof window === "undefined") return

  try {
    const recent = getRecentlyPlayed()
    const filtered = recent.filter((s) => s.id !== song.id)
    const updated = [song, ...filtered].slice(0, MAX_RECENT_SONGS)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error("Failed to save to recently played:", error)
  }
}

export function getLikedSongs(): Song[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(LIKED_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function isLiked(songId: string): boolean {
  const liked = getLikedSongs()
  return liked.some((s) => s.id === songId)
}

export function toggleLike(song: Song): boolean {
  if (typeof window === "undefined") return false

  try {
    const liked = getLikedSongs()
    const exists = liked.some((s) => s.id === song.id)

    if (exists) {
      const filtered = liked.filter((s) => s.id !== song.id)
      localStorage.setItem(LIKED_KEY, JSON.stringify(filtered))
      return false
    } else {
      const updated = [song, ...liked]
      localStorage.setItem(LIKED_KEY, JSON.stringify(updated))
      return true
    }
  } catch (error) {
    console.error("Failed to toggle like:", error)
    return false
  }
}

export function getCachedSongs(): CachedSong[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(CACHED_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function addToCached(song: CachedSong): void {
  if (typeof window === "undefined") return

  try {
    const cached = getCachedSongs()
    const filtered = cached.filter((s) => s.id !== song.id)
    const updated = [song, ...filtered].slice(0, MAX_CACHED_SONGS)
    localStorage.setItem(CACHED_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error("Failed to save to cache:", error)
  }
}

export function getCachedSongUrl(songId: string): string | null {
  const cached = getCachedSongs()
  const song = cached.find((s) => s.id === songId)
  return song?.audioUrl || null
}

export function getDownloadedSongs(): DownloadedSong[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(DOWNLOADED_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function isDownloaded(songId: string): boolean {
  const downloaded = getDownloadedSongs()
  return downloaded.some((s) => s.id === songId)
}

export function addToDownloaded(song: DownloadedSong): void {
  if (typeof window === "undefined") return

  try {
    const downloaded = getDownloadedSongs()
    const filtered = downloaded.filter((s) => s.id !== song.id)
    const updated = [song, ...filtered]
    localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(updated))
  } catch (error) {
    console.error("Failed to save download:", error)
  }
}

export function removeDownloaded(songId: string): void {
  if (typeof window === "undefined") return

  try {
    const downloaded = getDownloadedSongs()
    const filtered = downloaded.filter((s) => s.id !== songId)
    localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(filtered))
  } catch (error) {
    console.error("Failed to remove download:", error)
  }
}

export function getPlaylists(): Playlist[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(PLAYLISTS_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function getPlaylist(playlistId: string): Playlist | null {
  const playlists = getPlaylists()
  return playlists.find((p) => p.id === playlistId) || null
}

export function createPlaylist(name: string, description?: string): Playlist {
  const playlist: Playlist = {
    id: `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name,
    description,
    songs: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  try {
    const playlists = getPlaylists()
    playlists.push(playlist)
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists))
    return playlist
  } catch (error) {
    console.error("Failed to create playlist:", error)
    return playlist
  }
}

export function addSongToPlaylist(playlistId: string, song: Song): boolean {
  if (typeof window === "undefined") return false

  try {
    const playlists = getPlaylists()
    const playlistIndex = playlists.findIndex((p) => p.id === playlistId)

    if (playlistIndex === -1) return false

    const playlist = playlists[playlistIndex]
    const songExists = playlist.songs.some((s) => s.id === song.id)

    if (songExists) return false

    playlist.songs.push(song)
    playlist.updatedAt = Date.now()
    playlists[playlistIndex] = playlist
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists))
    return true
  } catch (error) {
    console.error("Failed to add song to playlist:", error)
    return false
  }
}

export function removeSongFromPlaylist(playlistId: string, songId: string): boolean {
  if (typeof window === "undefined") return false

  try {
    const playlists = getPlaylists()
    const playlistIndex = playlists.findIndex((p) => p.id === playlistId)

    if (playlistIndex === -1) return false

    const playlist = playlists[playlistIndex]
    playlist.songs = playlist.songs.filter((s) => s.id !== songId)
    playlist.updatedAt = Date.now()
    playlists[playlistIndex] = playlist
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists))
    return true
  } catch (error) {
    console.error("Failed to remove song from playlist:", error)
    return false
  }
}

export function deletePlaylist(playlistId: string): boolean {
  if (typeof window === "undefined") return false

  try {
    const playlists = getPlaylists()
    const filtered = playlists.filter((p) => p.id !== playlistId)
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(filtered))
    return true
  } catch (error) {
    console.error("Failed to delete playlist:", error)
    return false
  }
}

export function updatePlaylist(playlistId: string, updates: Partial<Pick<Playlist, "name" | "description">>): boolean {
  if (typeof window === "undefined") return false

  try {
    const playlists = getPlaylists()
    const playlistIndex = playlists.findIndex((p) => p.id === playlistId)

    if (playlistIndex === -1) return false

    const playlist = playlists[playlistIndex]
    playlists[playlistIndex] = {
      ...playlist,
      ...updates,
      updatedAt: Date.now(),
    }
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists))
    return true
  } catch (error) {
    console.error("Failed to update playlist:", error)
    return false
  }
}

export function exportPlaylist(playlistId: string): void {
  const playlist = getPlaylist(playlistId)
  if (!playlist) return
  const data = JSON.stringify(playlist, null, 2)
  const blob = new Blob([data], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${playlist.name.replace(/\s+/g, "_")}_playlist.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function importPlaylist(playlistData: string): Playlist | null {
  try {
    const playlist = JSON.parse(playlistData) as Playlist
    // Basic validation
    if (!playlist.name || !Array.isArray(playlist.songs)) return null

    // Generate new ID to avoid conflicts
    playlist.id = `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    playlist.createdAt = Date.now()
    playlist.updatedAt = Date.now()

    const playlists = getPlaylists()
    playlists.push(playlist)
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists))
    return playlist
  } catch {
    return null
  }
}

// ─── User Preferences ─────────────────────────────────────
const PREFS_KEY = "musicana_preferences"

export interface UserPreferences {
  country: string                    // ISO 2-letter, e.g. "US", "IN", "ZZ" (global)
  language: string                   // display lang hint, e.g. "en"
  theme: "dark" | "light" | "system"
  // AI features (Groq)
  groqApiKey:           string       // user-supplied Groq API key
  transliterateEnabled: boolean      // show transliteration button in lyrics
  translationEnabled:   boolean      // show translation button in lyrics
  transliterateLanguage: string      // target language for both, e.g. "English", "Hindi"
}

const DEFAULT_PREFS: UserPreferences = {
  country:               "ZZ",
  language:              "en",
  theme:                 "system",
  groqApiKey:            "",
  transliterateEnabled:  true,
  translationEnabled:    true,
  transliterateLanguage: "English",
}

export function getPreferences(): UserPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFS
  try {
    const stored = localStorage.getItem(PREFS_KEY)
    return stored ? { ...DEFAULT_PREFS, ...JSON.parse(stored) } : DEFAULT_PREFS
  } catch { return DEFAULT_PREFS }
}

export function savePreferences(prefs: Partial<UserPreferences>): UserPreferences {
  const current = getPreferences()
  const updated = { ...current, ...prefs }
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(updated)) } catch {}
  return updated
}

export function getCountry(): string {
  return getPreferences().country
}

// ─── Party Username & Guest ID ──────────────────────────────
const PARTY_USERNAME_KEY = "musicana_party_username"
const GUEST_ID_KEY       = "musicana_guest_id"

export function getPartyUsername(): string {
  if (typeof window === "undefined") return "Guest"
  try {
    return localStorage.getItem(PARTY_USERNAME_KEY) || "Guest"
  } catch { return "Guest" }
}

export function savePartyUsername(name: string): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(PARTY_USERNAME_KEY, name.trim() || "Guest") } catch {}
}

export function getGuestId(): string {
  if (typeof window === "undefined") return "guest_0"
  try {
    let id = localStorage.getItem(GUEST_ID_KEY)
    if (!id) {
      id = "guest_" + Math.random().toString(36).slice(2, 9)
      localStorage.setItem(GUEST_ID_KEY, id)
    }
    return id
  } catch { return "guest_0" }
}

// ─── Listening Stats ────────────────────────────────────────
// Stores seconds listened per UTC date string "YYYY-MM-DD"
const LISTEN_KEY = "musicana_listen_stats"

interface ListenStats { [date: string]: number }

function getListenStats(): ListenStats {
  if (typeof window === "undefined") return {}
  try {
    const s = localStorage.getItem(LISTEN_KEY)
    return s ? JSON.parse(s) : {}
  } catch { return {} }
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function recordListenSeconds(seconds: number): void {
  if (typeof window === "undefined") return
  try {
    const stats = getListenStats()
    const key   = todayKey()
    stats[key]  = (stats[key] || 0) + seconds
    localStorage.setItem(LISTEN_KEY, JSON.stringify(stats))
  } catch {}
}

export function getTodayListenSeconds(): number {
  const stats = getListenStats()
  return stats[todayKey()] || 0
}

export function getMonthListenSeconds(): number {
  const stats  = getListenStats()
  const prefix = new Date().toISOString().slice(0, 7) // "YYYY-MM"
  return Object.entries(stats)
    .filter(([k]) => k.startsWith(prefix))
    .reduce((acc, [, v]) => acc + v, 0)
}

export function getAllTimeListenSeconds(): number {
  return Object.values(getListenStats()).reduce((acc, v) => acc + v, 0)
}

export function getWeekListenData(): { date: string; seconds: number }[] {
  const stats  = getListenStats()
  const result = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    result.push({ date: key, seconds: stats[key] || 0 })
  }
  return result
}

export function fmtListenTime(secs: number): string {
  if (!secs || secs < 1) return "0s"
  if (secs < 60)  return `${Math.round(secs)}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  return `${h}h ${m}m`
}

export function clearListenStats(): void {
  if (typeof window === "undefined") return
  try { localStorage.removeItem(LISTEN_KEY) } catch {}
}

// ─── Song History (last 200 plays, duplicates kept for counting) ─
const HISTORY_KEY = "musicana_song_history"
const MAX_HISTORY = 200

export interface HistoryEntry {
  song:     Song
  playedAt: number   // unix ms
}

export function getSongHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return []
  try {
    const s = localStorage.getItem(HISTORY_KEY)
    return s ? JSON.parse(s) : []
  } catch { return [] }
}

// Returns deduplicated history (latest play per song) for display
export function getDeduplicatedHistory(): HistoryEntry[] {
  const history = getSongHistory()
  const seen    = new Set<string>()
  return history.filter(e => {
    if (seen.has(e.song.id)) return false
    seen.add(e.song.id)
    return true
  })
}

// Keep ALL plays — duplicates allowed — for top-played counting
export function addToSongHistory(song: Song): void {
  if (typeof window === "undefined") return
  try {
    const history = getSongHistory()
    const updated = [{ song, playedAt: Date.now() }, ...history].slice(0, MAX_HISTORY)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  } catch {}
}

export function clearSongHistory(): void {
  if (typeof window === "undefined") return
  try { localStorage.removeItem(HISTORY_KEY) } catch {}
}

export interface TopSong {
  song:   Song
  plays:  number
}

// Returns top N songs by play count within a time window
export function getTopPlayedSongs(period: "day" | "week" | "month", limit = 5): TopSong[] {
  const history  = getSongHistory()
  const now      = Date.now()
  const cutoff   = period === "day"   ? now - 86_400_000
                 : period === "week"  ? now - 7 * 86_400_000
                 :                     now - 30 * 86_400_000

  const counts   = new Map<string, { song: Song; plays: number }>()
  for (const e of history) {
    if (e.playedAt < cutoff) continue
    const id = e.song.id
    if (!counts.has(id)) counts.set(id, { song: e.song, plays: 0 })
    counts.get(id)!.plays++
  }

  return [...counts.values()]
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit)
}

// ─── Heatmap — 6 months of daily listen data ────────────────
export interface HeatmapDay {
  date:    string   // "YYYY-MM-DD"
  seconds: number
  level:   0 | 1 | 2 | 3 | 4  // 0=none, 4=most
}

export function getHeatmapData(): HeatmapDay[] {
  const stats  = getListenStats()
  const result: HeatmapDay[] = []
  const today  = new Date()

  // Go back 26 weeks (182 days)
  for (let i = 181; i >= 0; i--) {
    const d   = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    const secs = stats[key] || 0

    let level: 0 | 1 | 2 | 3 | 4 = 0
    if      (secs === 0)    level = 0
    else if (secs < 300)    level = 1   // < 5 min
    else if (secs < 1200)   level = 2   // < 20 min
    else if (secs < 3600)   level = 3   // < 1 hr
    else                    level = 4   // 1hr+

    result.push({ date: key, seconds: secs, level })
  }
  return result
}
