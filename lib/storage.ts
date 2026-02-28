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
// ─── Favourite Song Moments ──────────────────────────────────
const FAV_MOMENTS_KEY = "musicana_fav_moments"

export interface FavMoment {
  videoId:  string
  time:     number   // seconds into the track
  label?:   string   // optional user label (future use)
  savedAt:  number   // unix ms
}

export function getFavMoments(videoId: string): FavMoment[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(FAV_MOMENTS_KEY)
    if (!raw) return []
    const all: Record<string, FavMoment[]> = JSON.parse(raw)
    return all[videoId] ?? []
  } catch { return [] }
}

export function saveFavMoment(videoId: string, time: number): FavMoment {
  const moment: FavMoment = { videoId, time: Math.round(time), savedAt: Date.now() }
  try {
    const raw = localStorage.getItem(FAV_MOMENTS_KEY)
    const all: Record<string, FavMoment[]> = raw ? JSON.parse(raw) : {}
    const existing = all[videoId] ?? []
    // Deduplicate — don't save if within 5s of an existing moment
    const isDup = existing.some(m => Math.abs(m.time - moment.time) < 5)
    if (!isDup) {
      all[videoId] = [...existing, moment].slice(-5) // max 5 moments per song
      localStorage.setItem(FAV_MOMENTS_KEY, JSON.stringify(all))
    }
  } catch {}
  return moment
}

export function deleteFavMoment(videoId: string, savedAt: number): void {
  try {
    const raw = localStorage.getItem(FAV_MOMENTS_KEY)
    if (!raw) return
    const all: Record<string, FavMoment[]> = JSON.parse(raw)
    all[videoId] = (all[videoId] ?? []).filter(m => m.savedAt !== savedAt)
    if (!all[videoId].length) delete all[videoId]
    localStorage.setItem(FAV_MOMENTS_KEY, JSON.stringify(all))
  } catch {}
}

const PREFS_KEY = "musicana_preferences"

export interface UserPreferences {
  country: string                    // ISO 2-letter, e.g. "US", "IN", "ZZ" (global)
  language: string                   // display lang hint, e.g. "en"
  theme: "dark" | "light" | "system"
  // AI features (Groq)
  groqApiKey:           string       // user-supplied Groq API key
  transliterateEnabled: boolean      // show transliteration button in lyrics
  translationEnabled:   boolean      // show translation button in lyrics
  transliterateLanguage: string      // target language for both
  crossfadeSecs:         number       // 0 = off, 2/4/6/8 = crossfade seconds
  reactionsEnabled:      boolean      // show emoji reaction bar in player
}

const DEFAULT_PREFS: UserPreferences = {
  country:               "ZZ",
  language:              "en",
  theme:                 "system",
  groqApiKey:            "",
  transliterateEnabled:  true,
  translationEnabled:    true,
  transliterateLanguage: "English",
  crossfadeSecs:         0,
  reactionsEnabled:      true,
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

// ─── Reactions timeline ───────────────────────────────────────
const REACTIONS_KEY = "musicana_reactions"

export interface Reaction {
  emoji:     string
  timestamp: number   // seconds in song
  addedAt:   number   // unix ms
}

export function getReactions(songId: string): Reaction[] {
  if (typeof window === "undefined") return []
  try {
    const all = JSON.parse(localStorage.getItem(REACTIONS_KEY) || "{}")
    return (all[songId] || []) as Reaction[]
  } catch { return [] }
}

export function addReaction(songId: string, emoji: string, timestamp: number): void {
  if (typeof window === "undefined") return
  try {
    const all = JSON.parse(localStorage.getItem(REACTIONS_KEY) || "{}")
    if (!all[songId]) all[songId] = []
    all[songId].push({ emoji, timestamp: Math.floor(timestamp), addedAt: Date.now() })
    if (all[songId].length > 200) all[songId] = all[songId].slice(-200)
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(all))
  } catch {}
}

export function clearReactions(songId: string): void {
  if (typeof window === "undefined") return
  try {
    const all = JSON.parse(localStorage.getItem(REACTIONS_KEY) || "{}")
    delete all[songId]
    localStorage.setItem(REACTIONS_KEY, JSON.stringify(all))
  } catch {}
}

// ─── Collab Playlist refs (local bookmarks) ───────────────────
const COLLAB_KEY = "musicana_collab_refs"

export interface CollabRef {
  id:       string
  name:     string
  joined:   number   // unix ms
  isOwner:  boolean
}

export function getCollabRefs(): CollabRef[] {
  if (typeof window === "undefined") return []
  try {
    const s = localStorage.getItem(COLLAB_KEY)
    return s ? JSON.parse(s) : []
  } catch { return [] }
}

export function saveCollabRef(ref: CollabRef): void {
  if (typeof window === "undefined") return
  try {
    const refs = getCollabRefs().filter(r => r.id !== ref.id)
    localStorage.setItem(COLLAB_KEY, JSON.stringify([ref, ...refs].slice(0, 20)))
  } catch {}
}

export function removeCollabRef(id: string): void {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(COLLAB_KEY, JSON.stringify(getCollabRefs().filter(r => r.id !== id)))
  } catch {}
}

// ─── All-time top songs (no time window cutoff) ───────────────
export function getAllTimeTopSongs(limit = 10): TopSong[] {
  const history = getSongHistory()
  const counts  = new Map<string, { song: Song; plays: number }>()
  for (const e of history) {
    const id = e.song.id
    if (!counts.has(id)) counts.set(id, { song: e.song, plays: 0 })
    counts.get(id)!.plays++
  }
  return [...counts.values()]
    .sort((a, b) => b.plays - a.plays)
    .slice(0, limit)
}

// ─── Full data export / import ───────────────────────────────
const ALL_KEYS = [
  "lyrica_recently_played",
  "lyrica_liked_songs",
  "lyrica_playlists",
  "lyrica_downloaded_songs",
  "musicana_preferences",
  "musicana_party_username",
  "musicana_guest_id",
  "musicana_listen_stats",
  "musicana_song_history",
  "musicana_reactions",
  "musicana_collab_refs",
]

export interface MusicanaBackup {
  version:   number
  exportedAt: number
  data:       Record<string, any>
}

export function exportAllData(): void {
  if (typeof window === "undefined") return
  try {
    const data: Record<string, any> = {}
    for (const key of ALL_KEYS) {
      const raw = localStorage.getItem(key)
      if (raw) {
        try { data[key] = JSON.parse(raw) } catch { data[key] = raw }
      }
    }
    const backup: MusicanaBackup = {
      version:    1,
      exportedAt: Date.now(),
      data,
    }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    const date = new Date().toISOString().slice(0, 10)
    a.href     = url
    a.download = `musicana-backup-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) { console.error("Export failed:", e) }
}

export function importAllData(
  json: string,
  mode: "merge" | "replace" = "replace",
): { ok: boolean; error?: string; keysRestored: number } {
  if (typeof window === "undefined") return { ok: false, error: "Not in browser", keysRestored: 0 }
  try {
    const backup: MusicanaBackup = JSON.parse(json)
    if (!backup?.data || typeof backup.data !== "object") {
      return { ok: false, error: "Invalid backup file format", keysRestored: 0 }
    }
    if (backup.version !== 1) {
      return { ok: false, error: `Unknown backup version: ${backup.version}`, keysRestored: 0 }
    }

    let keysRestored = 0

    if (mode === "replace") {
      // Wipe existing keys first
      for (const key of ALL_KEYS) localStorage.removeItem(key)
    }

    for (const [key, value] of Object.entries(backup.data)) {
      if (!ALL_KEYS.includes(key)) continue   // only restore known keys

      if (mode === "merge") {
        // For arrays: merge by id. For objects: spread. Preferences always replace.
        const existing = localStorage.getItem(key)
        if (existing && key !== "musicana_preferences") {
          try {
            const ex = JSON.parse(existing)
            if (Array.isArray(ex) && Array.isArray(value)) {
              const ids = new Set(ex.map((x: any) => x.id || x.videoId))
              const merged = [...ex, ...(value as any[]).filter((x: any) => !ids.has(x.id || x.videoId))]
              localStorage.setItem(key, JSON.stringify(merged))
              keysRestored++
              continue
            }
            if (typeof ex === "object" && typeof value === "object" && !Array.isArray(value)) {
              localStorage.setItem(key, JSON.stringify({ ...ex, ...(value as object) }))
              keysRestored++
              continue
            }
          } catch {}
        }
      }

      localStorage.setItem(key, JSON.stringify(value))
      keysRestored++
    }

    return { ok: true, keysRestored }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Parse error", keysRestored: 0 }
  }
}

// ═══════════════════════════════════════════════════════════════
// ─── Badge & XP System ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════

const BADGE_EVENTS_KEY  = "musicana_badge_events"
const BADGE_EARNED_KEY  = "musicana_badge_earned"   // Set<badgeId> stored as array

export type BadgeTier = "normal" | "uncommon" | "epic" | "rare"

export interface Badge {
  id:          string
  name:        string
  description: string
  emoji:       string
  tier:        BadgeTier
  xp:          number
  category:    "streak_app" | "streak_song" | "listening_time" | "time_based" | "behavior"
}

export interface BadgeStatus extends Badge {
  earned:   boolean
  earnedAt?: number   // unix ms
  progress: number    // 0–1
  current:  number    // current value
  target:   number    // value needed
}

// ── Event log for behavior badges ────────────────────────────
export interface BadgeEvent {
  type:    string
  at:      number  // unix ms
  meta?:   string  // e.g. songId for song streaks, genre name
}

function getBadgeEvents(): BadgeEvent[] {
  if (typeof window === "undefined") return []
  try {
    const s = localStorage.getItem(BADGE_EVENTS_KEY)
    return s ? JSON.parse(s) : []
  } catch { return [] }
}

function saveBadgeEvents(evs: BadgeEvent[]): void {
  // Keep last 5000 events max (rolling)
  try { localStorage.setItem(BADGE_EVENTS_KEY, JSON.stringify(evs.slice(0, 5000))) } catch {}
}

export function recordBadgeEvent(type: string, meta?: string): void {
  if (typeof window === "undefined") return
  const evs = getBadgeEvents()
  evs.unshift({ type, at: Date.now(), meta })
  saveBadgeEvents(evs)
}

function getEarnedBadgeIds(): Set<string> {
  if (typeof window === "undefined") return new Set()
  try {
    const s = localStorage.getItem(BADGE_EARNED_KEY)
    return new Set(s ? JSON.parse(s) : [])
  } catch { return new Set() }
}

function getEarnedBadgeTimes(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const s = localStorage.getItem(BADGE_EARNED_KEY + "_times")
    return s ? JSON.parse(s) : {}
  } catch { return {} }
}

function markBadgeEarned(id: string): void {
  if (typeof window === "undefined") return
  try {
    const ids = getEarnedBadgeIds()
    ids.add(id)
    localStorage.setItem(BADGE_EARNED_KEY, JSON.stringify([...ids]))
    const times = getEarnedBadgeTimes()
    if (!times[id]) times[id] = Date.now()
    localStorage.setItem(BADGE_EARNED_KEY + "_times", JSON.stringify(times))
  } catch {}
}

// ── Badge definitions ─────────────────────────────────────────
const XP: Record<BadgeTier, number> = { normal: 50, uncommon: 100, epic: 250, rare: 500 }

function b(
  id: string, name: string, description: string, emoji: string,
  tier: BadgeTier, category: Badge["category"],
): Badge {
  return { id, name, description, emoji, tier, xp: XP[tier], category }
}

export const ALL_BADGES: Badge[] = [
  // ── App Streak ───────────────────────────────────────────
  b("streak_app_1",   "First Spark",       "1 day app streak",   "✨", "normal",   "streak_app"),
  b("streak_app_3",   "3 Day Flow",        "3 day app streak",   "🌊", "normal",   "streak_app"),
  b("streak_app_7",   "Weekly Listener",   "7 day app streak",   "🎧", "uncommon", "streak_app"),
  b("streak_app_10",  "10 Day Rhythm",     "10 day app streak",  "🥁", "uncommon", "streak_app"),
  b("streak_app_14",  "Fortnight Flame",   "14 day app streak",  "🔥", "uncommon", "streak_app"),
  b("streak_app_30",  "Monthly Vibes",     "30 day app streak",  "🌙", "epic",     "streak_app"),
  b("streak_app_60",  "60 Day Momentum",   "60 day app streak",  "⚡", "epic",     "streak_app"),
  b("streak_app_90",  "90 Day Harmony",    "90 day app streak",  "🎼", "epic",     "streak_app"),
  b("streak_app_180", "Half-Year Devotion","180 day app streak", "💎", "rare",     "streak_app"),
  b("streak_app_365", "365 Day Legend",    "365 day app streak", "👑", "rare",     "streak_app"),

  // ── Song Streak ──────────────────────────────────────────
  b("streak_song_3",   "Repeat Rookie",   "3 day same-song streak",   "🔁", "normal",   "streak_song"),
  b("streak_song_5",   "Loop Lover",      "5 day same-song streak",   "💫", "normal",   "streak_song"),
  b("streak_song_7",   "Hooked Hook",     "7 day same-song streak",   "🎣", "uncommon", "streak_song"),
  b("streak_song_10",  "Chorus Keeper",   "10 day same-song streak",  "🎤", "uncommon", "streak_song"),
  b("streak_song_15",  "Unskippable",     "15 day same-song streak",  "📌", "uncommon", "streak_song"),
  b("streak_song_30",  "Melody Loyalist", "30 day same-song streak",  "🎵", "epic",     "streak_song"),
  b("streak_song_60",  "Track Devotion",  "60 day same-song streak",  "💝", "epic",     "streak_song"),
  b("streak_song_90",  "Obsession Mode",  "90 day same-song streak",  "🌀", "epic",     "streak_song"),
  b("streak_song_180", "Timeless Bond",   "180 day same-song streak", "∞",  "rare",     "streak_song"),
  b("streak_song_365", "One Song Eternity","365 day same-song streak","🏛️", "rare",     "streak_song"),

  // ── Listening Time ───────────────────────────────────────
  b("time_30m",   "30 Minute Mood",    "30 total listening minutes", "😌", "normal",   "listening_time"),
  b("time_2h",    "2 Hour Explorer",   "2 total listening hours",   "🗺️", "normal",   "listening_time"),
  b("time_10h",   "10 Hour Listener",  "10 total hours",            "🎯", "uncommon", "listening_time"),
  b("time_25h",   "25 Hour Groove",    "25 total hours",            "🕺", "uncommon", "listening_time"),
  b("time_50h",   "50 Hour Pulse",     "50 total hours",            "💓", "uncommon", "listening_time"),
  b("time_100h",  "100 Hour Immersion","100 total hours",           "🔮", "epic",     "listening_time"),
  b("time_250h",  "250 Hour Devotee",  "250 total hours",           "🌟", "epic",     "listening_time"),
  b("time_500h",  "500 Hour Addict",   "500 total hours",           "🚀", "epic",     "listening_time"),
  b("time_1000h", "1000 Hour Master",  "1000 total hours",          "🏆", "rare",     "listening_time"),
  b("time_2000h", "Sound Immortal",    "2000 total hours",          "🪐", "rare",     "listening_time"),

  // ── Time-Based ───────────────────────────────────────────
  b("night_3",    "Night Owl",          "3 late-night sessions (after midnight)",  "🦉", "normal",   "time_based"),
  b("night_7",    "Midnight Rider",     "7 late-night sessions",                   "🌃", "uncommon", "time_based"),
  b("night_15",   "3AM Soul",           "15 sessions at 3 AM",                     "🌑", "epic",     "time_based"),
  b("night_100",  "After Dark Legend",  "100 midnight sessions",                   "🌌", "rare",     "time_based"),
  b("morning_5",  "Sunrise Seeker",     "5 early-morning sessions",                "🌅", "normal",   "time_based"),
  b("morning_30", "Dawn Devotion",      "30 early-morning sessions",               "☀️", "epic",     "time_based"),

  // ── Behavior ─────────────────────────────────────────────
  b("noskip_10",   "No Skip Session",   "10 songs without skipping",   "🎵", "normal",   "behavior"),
  b("noskip_50",   "Skip Resistant",    "50 songs without skipping",   "🛡️", "uncommon", "behavior"),
  b("noskip_100",  "Zen Listener",      "100 songs without skipping",  "🧘", "epic",     "behavior"),
  b("genre_5",     "Genre Explorer",    "5 different genres explored",  "🌍", "normal",   "behavior"),
  b("genre_15",    "Sound Adventurer",  "15 genres explored",           "🧭", "uncommon", "behavior"),
  b("genre_30",    "Sonic Traveller",   "30 genres explored",           "✈️", "epic",     "behavior"),
  b("volume_20",   "Volume Warrior",    "20 max-volume sessions",       "🔊", "normal",   "behavior"),
  b("playlist_10", "Playlist Architect","Create 10 playlists",          "📋", "uncommon", "behavior"),
  b("heatmap_25",  "Heatmap Hero",      "Active 25 days in one month",  "🗓️", "uncommon", "behavior"),
  b("silent_week", "Silent Week",       "Return after 7 days inactive", "🔔", "epic",     "behavior"),
  b("royalty",     "Musicana Royalty",  "Unlock 25 total badges",       "👑", "rare",     "behavior"),
]

// ── Streak helpers ─────────────────────────────────────────────
function getAppStreakDays(): number {
  // Count consecutive days with listen data, ending today
  const stats  = getListenStats()
  let   streak = 0
  const today  = new Date()
  for (let i = 0; i < 400; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    if ((stats as any)[key] > 0) streak++
    else if (i > 0) break  // gap — streak ends
  }
  return streak
}

function getSongStreakDays(): { songId: string; days: number } {
  // Find the most-played song with the longest consecutive daily streak
  const history = getSongHistory()
  if (!history.length) return { songId: "", days: 0 }

  // Group plays by (songId, dateKey)
  const songDays = new Map<string, Set<string>>()
  for (const e of history) {
    const key = new Date(e.playedAt).toISOString().slice(0, 10)
    const id  = e.song.id
    if (!songDays.has(id)) songDays.set(id, new Set())
    songDays.get(id)!.add(key)
  }

  // Find best streak per song
  let best = { songId: "", days: 0 }
  for (const [songId, dateSet] of songDays) {
    const dates = [...dateSet].sort().reverse()
    let streak  = 0
    const today = new Date()
    for (let i = 0; i < 400; i++) {
      const d   = new Date(today)
      d.setDate(d.getDate() - i)
      if (dateSet.has(d.toISOString().slice(0, 10))) streak++
      else if (i > 0) break
    }
    if (streak > best.days) best = { songId, days: streak }
  }
  return best
}

// ── Main evaluation function ─────────────────────────────────
export function evaluateBadges(): BadgeStatus[] {
  const earnedIds    = getEarnedBadgeIds()
  const earnedTimes  = getEarnedBadgeTimes()
  const events       = getBadgeEvents()
  const totalSecs    = getAllTimeListenSeconds()
  const totalHours   = totalSecs / 3600
  const appStreak    = getAppStreakDays()
  const songStreak   = getSongStreakDays()
  const heatmap      = getListenStats()
  const playlists    = getPlaylists()

  // Count behavior events
  const noSkipCount  = (() => {
    // Count total consecutive no-skips from event log
    let count = 0
    let max   = 0
    for (const ev of [...events].reverse()) {
      if (ev.type === "song_complete") { count++; max = Math.max(max, count) }
      else if (ev.type === "skip")     { count = 0 }
    }
    return max
  })()

  const genres = new Set(events.filter(e => e.type === "genre_play" && e.meta).map(e => e.meta!))
  const volumeMaxCount = events.filter(e => e.type === "volume_max").length

  // Midnight / early-morning sessions
  const nightSessions    = events.filter(e => {
    const h = new Date(e.at).getHours()
    return e.type === "session_start" && (h >= 0 && h < 4)
  }).length
  const at3am = events.filter(e => {
    const h = new Date(e.at).getHours()
    return e.type === "session_start" && h === 3
  }).length
  const morningSessions = events.filter(e => {
    const h = new Date(e.at).getHours()
    return e.type === "session_start" && (h >= 5 && h <= 8)
  }).length

  // Heatmap: active days in current month
  const thisMonth = new Date().toISOString().slice(0, 7)
  const activeDaysThisMonth = Object.entries(heatmap)
    .filter(([k, v]) => k.startsWith(thisMonth) && v > 0).length

  // Silent week: came back after 7+ day gap
  const hasSilentWeek = (() => {
    const stats = heatmap
    const keys  = Object.keys(stats).sort()
    for (let i = 1; i < keys.length; i++) {
      const prev = new Date(keys[i - 1]).getTime()
      const curr = new Date(keys[i]).getTime()
      if ((curr - prev) >= 7 * 86_400_000) return true
    }
    return false
  })()

  // Value map: badge id → { current, target }
  const valueMap: Record<string, { current: number; target: number }> = {
    // App streaks
    "streak_app_1":   { current: appStreak, target: 1   },
    "streak_app_3":   { current: appStreak, target: 3   },
    "streak_app_7":   { current: appStreak, target: 7   },
    "streak_app_10":  { current: appStreak, target: 10  },
    "streak_app_14":  { current: appStreak, target: 14  },
    "streak_app_30":  { current: appStreak, target: 30  },
    "streak_app_60":  { current: appStreak, target: 60  },
    "streak_app_90":  { current: appStreak, target: 90  },
    "streak_app_180": { current: appStreak, target: 180 },
    "streak_app_365": { current: appStreak, target: 365 },
    // Song streaks
    "streak_song_3":   { current: songStreak.days, target: 3   },
    "streak_song_5":   { current: songStreak.days, target: 5   },
    "streak_song_7":   { current: songStreak.days, target: 7   },
    "streak_song_10":  { current: songStreak.days, target: 10  },
    "streak_song_15":  { current: songStreak.days, target: 15  },
    "streak_song_30":  { current: songStreak.days, target: 30  },
    "streak_song_60":  { current: songStreak.days, target: 60  },
    "streak_song_90":  { current: songStreak.days, target: 90  },
    "streak_song_180": { current: songStreak.days, target: 180 },
    "streak_song_365": { current: songStreak.days, target: 365 },
    // Listening time
    "time_30m":   { current: totalHours * 60,  target: 30    },
    "time_2h":    { current: totalHours,        target: 2     },
    "time_10h":   { current: totalHours,        target: 10    },
    "time_25h":   { current: totalHours,        target: 25    },
    "time_50h":   { current: totalHours,        target: 50    },
    "time_100h":  { current: totalHours,        target: 100   },
    "time_250h":  { current: totalHours,        target: 250   },
    "time_500h":  { current: totalHours,        target: 500   },
    "time_1000h": { current: totalHours,        target: 1000  },
    "time_2000h": { current: totalHours,        target: 2000  },
    // Time-based
    "night_3":    { current: nightSessions, target: 3   },
    "night_7":    { current: nightSessions, target: 7   },
    "night_15":   { current: at3am,         target: 15  },
    "night_100":  { current: nightSessions, target: 100 },
    "morning_5":  { current: morningSessions, target: 5  },
    "morning_30": { current: morningSessions, target: 30 },
    // Behavior
    "noskip_10":   { current: noSkipCount,          target: 10  },
    "noskip_50":   { current: noSkipCount,          target: 50  },
    "noskip_100":  { current: noSkipCount,          target: 100 },
    "genre_5":     { current: genres.size,           target: 5   },
    "genre_15":    { current: genres.size,           target: 15  },
    "genre_30":    { current: genres.size,           target: 30  },
    "volume_20":   { current: volumeMaxCount,        target: 20  },
    "playlist_10": { current: playlists.length,      target: 10  },
    "heatmap_25":  { current: activeDaysThisMonth,   target: 25  },
    "silent_week": { current: hasSilentWeek ? 1 : 0, target: 1   },
    "royalty":     { current: 0 /* filled below */,  target: 25  },
  }

  // First pass: evaluate all except royalty
  const results: BadgeStatus[] = ALL_BADGES.map(badge => {
    const v        = valueMap[badge.id] ?? { current: 0, target: 1 }
    const metEarly = earnedIds.has(badge.id)  // already earned, keep forever
    const metNow   = v.current >= v.target
    const earned   = metEarly || metNow

    if (earned && !metEarly) markBadgeEarned(badge.id)

    return {
      ...badge,
      earned,
      earnedAt: earnedTimes[badge.id],
      progress: Math.min(1, v.current / v.target),
      current:  v.current,
      target:   v.target,
    }
  })

  // Second pass: royalty (needs count of earned badges)
  const earnedCount = results.filter(r => r.earned && r.id !== "royalty").length
  const royalty     = results.find(r => r.id === "royalty")!
  royalty.current   = earnedCount
  royalty.progress  = Math.min(1, earnedCount / 25)
  if (!royalty.earned && earnedCount >= 25) {
    royalty.earned = true
    markBadgeEarned("royalty")
  }

  return results
}

export function getEarnedBadges(): BadgeStatus[] {
  return evaluateBadges().filter(b => b.earned)
}

export function getTotalXP(): number {
  return getEarnedBadges().reduce((acc, b) => acc + b.xp, 0)
}

// Compute XP level from total XP
export function getXPLevel(xp: number): { level: number; title: string; nextAt: number } {
  const thresholds = [
    { level: 1,  title: "Newcomer",    nextAt: 100  },
    { level: 2,  title: "Listener",    nextAt: 300  },
    { level: 3,  title: "Music Fan",   nextAt: 600  },
    { level: 4,  title: "Enthusiast",  nextAt: 1000 },
    { level: 5,  title: "Devotee",     nextAt: 1500 },
    { level: 6,  title: "Connoisseur", nextAt: 2500 },
    { level: 7,  title: "Legend",      nextAt: 4000 },
    { level: 8,  title: "Immortal",    nextAt: Infinity },
  ]
  for (const t of thresholds) {
    if (xp < t.nextAt) return t
  }
  return thresholds[thresholds.length - 1]
}
