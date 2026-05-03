/**
 * Musicanaz storage.ts  v2 — drop-in replacement
 * All localStorage access goes through SafeStore / SharedStore.
 * Public API is 100% backward-compatible with v1.
 */
import { SafeStore, SharedStore } from "./store"
import type { Song } from "./types"

// ─── Shared keys (namespaced internally by SharedStore) ───────────────────────
const K = {
  RECENT:       "recently_played",
  LIKED:        "liked_songs",
  CACHED:       "cached_songs",
  PLAYLISTS:    "playlists",
  DOWNLOADED:   "downloaded_songs",
  FAV_MOMENTS:  "fav_moments",
  PREFS:        "preferences",
  PARTY_USER:   "party_username",
  GUEST_ID:     "guest_id",
  LISTEN_STATS: "listen_stats",
  HISTORY:      "song_history",
  REACTIONS:    "reactions",
  COLLAB:       "collab_refs",
  BADGE_EVENTS: "badge_events_full",
  BADGE_EARNED: "badge_earned_set",
  BADGE_TIMES:  "badge_earned_times",
} as const

// ─── Safe keys ────────────────────────────────────────────────────────────────
const SK = {
  YT_COOKIES_ENC: "yt_cookies_enc",
  ENC_KEY:        "yt_enc_key",
} as const

const MAX_RECENT  = 12
const MAX_CACHED  = 20
const MAX_HISTORY = 200

// All shared keys as flat strings (for export/import)
const ALL_SHARED_KEYS = Object.values(K).map(k => "mz_shared:" + k)

// ═════════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════════════════════════════════

export interface Playlist {
  id: string; name: string; description?: string
  songs: Song[]; createdAt: number; updatedAt: number
}
export interface CachedSong extends Song { audioUrl: string; audioBlob?: string; cachedAt: number }
export interface DownloadedSong extends CachedSong { downloadedAt: number }
export interface FavMoment { videoId: string; time: number; label?: string; savedAt: number }

export interface UserPreferences {
  country: string; language: string; theme: "dark" | "light" | "system"
  groqApiKey: string; transliterateEnabled: boolean; translationEnabled: boolean
  transliterateLanguage: string; crossfadeSecs: number; reactionsEnabled: boolean
  trendingSource: string; chartsSource: string; blurThumbnailBg: boolean
  lyricsAutoScroll: boolean
}

const DEFAULT_PREFS: UserPreferences = {
  country: "ZZ", language: "en", theme: "system",
  groqApiKey: "", transliterateEnabled: true, translationEnabled: true,
  transliterateLanguage: "English", crossfadeSecs: 0, reactionsEnabled: true,
  trendingSource: "all", chartsSource: "all", blurThumbnailBg: false,
  lyricsAutoScroll: true,
}

export interface HistoryEntry { song: Song; playedAt: number }
export interface TopSong      { song: Song; plays: number }
export interface TopArtist {
  artist: string; thumbnail: string; plays: number
  listenSeconds: number; songCount: number
}
export interface HeatmapDay {
  date:    string
  seconds: number
  level:   0 | 1 | 2 | 3 | 4
}
export interface Reaction {
  emoji:     string
  timestamp: number
  addedAt:   number
}
export interface CollabRef {
  id: string; name: string; joined: number; isOwner: boolean
}
export interface BadgeEvent { type: string; at: number; meta?: string }

// ═════════════════════════════════════════════════════════════════════════════
// Recently Played
// ═════════════════════════════════════════════════════════════════════════════

export function getRecentlyPlayed(): Song[] {
  return SharedStore.get<Song[]>(K.RECENT, [])
}
export function addToRecentlyPlayed(song: Song): void {
  const updated = [song, ...getRecentlyPlayed().filter(s => s.id !== song.id)].slice(0, MAX_RECENT)
  SharedStore.set(K.RECENT, updated)
}

// ═════════════════════════════════════════════════════════════════════════════
// Liked Songs
// ═════════════════════════════════════════════════════════════════════════════

export function getLikedSongs(): Song[] { return SharedStore.get<Song[]>(K.LIKED, []) }
export function isLiked(songId: string): boolean { return getLikedSongs().some(s => s.id === songId) }
export function toggleLike(song: Song): boolean {
  const liked = getLikedSongs()
  const exists = liked.some(s => s.id === song.id)
  SharedStore.set(K.LIKED, exists ? liked.filter(s => s.id !== song.id) : [song, ...liked])
  return !exists
}

// ═════════════════════════════════════════════════════════════════════════════
// Cached / Downloaded
// ═════════════════════════════════════════════════════════════════════════════

export function getCachedSongs(): CachedSong[] { return SharedStore.get<CachedSong[]>(K.CACHED, []) }
export function addToCached(song: CachedSong): void {
  const updated = [song, ...getCachedSongs().filter(s => s.id !== song.id)].slice(0, MAX_CACHED)
  SharedStore.set(K.CACHED, updated)
}
export function getCachedSongUrl(songId: string): string | null {
  return getCachedSongs().find(s => s.id === songId)?.audioUrl ?? null
}
export function getDownloadedSongs(): DownloadedSong[] { return SharedStore.get<DownloadedSong[]>(K.DOWNLOADED, []) }
export function isDownloaded(songId: string): boolean { return getDownloadedSongs().some(s => s.id === songId) }
export function addToDownloaded(song: DownloadedSong): void {
  SharedStore.set(K.DOWNLOADED, [song, ...getDownloadedSongs().filter(s => s.id !== song.id)])
}
export function removeDownloaded(songId: string): void {
  SharedStore.set(K.DOWNLOADED, getDownloadedSongs().filter(s => s.id !== songId))
}

// ═════════════════════════════════════════════════════════════════════════════
// Playlists
// ═════════════════════════════════════════════════════════════════════════════

export function getPlaylists(): Playlist[] { return SharedStore.get<Playlist[]>(K.PLAYLISTS, []) }
export function getPlaylist(id: string): Playlist | null { return getPlaylists().find(p => p.id === id) ?? null }

export function createPlaylist(name: string, description?: string): Playlist {
  const p: Playlist = {
    id: `playlist_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    name, description, songs: [], createdAt: Date.now(), updatedAt: Date.now(),
  }
  SharedStore.set(K.PLAYLISTS, [...getPlaylists(), p])
  return p
}
export function addSongToPlaylist(playlistId: string, song: Song): boolean {
  const playlists = getPlaylists()
  const idx = playlists.findIndex(p => p.id === playlistId)
  if (idx === -1) return false
  if (playlists[idx].songs.some(s => s.id === song.id)) return false
  playlists[idx] = { ...playlists[idx], songs: [...playlists[idx].songs, song], updatedAt: Date.now() }
  SharedStore.set(K.PLAYLISTS, playlists)
  return true
}
export function removeSongFromPlaylist(playlistId: string, songId: string): boolean {
  const playlists = getPlaylists()
  const idx = playlists.findIndex(p => p.id === playlistId)
  if (idx === -1) return false
  playlists[idx] = { ...playlists[idx], songs: playlists[idx].songs.filter(s => s.id !== songId), updatedAt: Date.now() }
  SharedStore.set(K.PLAYLISTS, playlists)
  return true
}
export function deletePlaylist(playlistId: string): boolean {
  SharedStore.set(K.PLAYLISTS, getPlaylists().filter(p => p.id !== playlistId))
  return true
}
export function updatePlaylist(playlistId: string, updates: Partial<Pick<Playlist, "name" | "description">>): boolean {
  const playlists = getPlaylists()
  const idx = playlists.findIndex(p => p.id === playlistId)
  if (idx === -1) return false
  playlists[idx] = { ...playlists[idx], ...updates, updatedAt: Date.now() }
  SharedStore.set(K.PLAYLISTS, playlists)
  return true
}
export function exportPlaylist(playlistId: string): void {
  const p = getPlaylist(playlistId)
  if (!p) return
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url; a.download = `${p.name.replace(/\s+/g, "_")}_playlist.json`; a.click()
  URL.revokeObjectURL(url)
}
export function importPlaylist(data: string): Playlist | null {
  try {
    const p = JSON.parse(data) as Playlist
    if (!p.name || !Array.isArray(p.songs)) return null
    p.id = `playlist_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
    p.createdAt = p.updatedAt = Date.now()
    SharedStore.set(K.PLAYLISTS, [...getPlaylists(), p])
    return p
  } catch { return null }
}

// ═════════════════════════════════════════════════════════════════════════════
// Fav Moments
// ═════════════════════════════════════════════════════════════════════════════

export function getFavMoments(videoId: string): FavMoment[] {
  return (SharedStore.get<Record<string, FavMoment[]>>(K.FAV_MOMENTS, {}))[videoId] ?? []
}
export function saveFavMoment(videoId: string, time: number): FavMoment {
  const moment: FavMoment = { videoId, time: Math.round(time), savedAt: Date.now() }
  const all = SharedStore.get<Record<string, FavMoment[]>>(K.FAV_MOMENTS, {})
  const existing = all[videoId] ?? []
  if (!existing.some(m => Math.abs(m.time - moment.time) < 5)) {
    all[videoId] = [...existing, moment].slice(-5)
    SharedStore.set(K.FAV_MOMENTS, all)
  }
  return moment
}
export function deleteFavMoment(videoId: string, savedAt: number): void {
  const all = SharedStore.get<Record<string, FavMoment[]>>(K.FAV_MOMENTS, {})
  all[videoId] = (all[videoId] ?? []).filter(m => m.savedAt !== savedAt)
  if (!all[videoId].length) delete all[videoId]
  SharedStore.set(K.FAV_MOMENTS, all)
}

// ═════════════════════════════════════════════════════════════════════════════
// Preferences
// ═════════════════════════════════════════════════════════════════════════════

export function getPreferences(): UserPreferences {
  return { ...DEFAULT_PREFS, ...SharedStore.get<Partial<UserPreferences>>(K.PREFS, {}) }
}
export function savePreferences(prefs: Partial<UserPreferences>): UserPreferences {
  const updated = { ...getPreferences(), ...prefs }
  SharedStore.set(K.PREFS, updated)
  return updated
}
export function getCountry(): string { return getPreferences().country }

// ═════════════════════════════════════════════════════════════════════════════
// Party / Guest
// ═════════════════════════════════════════════════════════════════════════════

export function getPartyUsername(): string { return SharedStore.get<string>(K.PARTY_USER, "Guest") }
export function savePartyUsername(name: string): void { SharedStore.set(K.PARTY_USER, name.trim() || "Guest") }
export function getGuestId(): string {
  const existing = SharedStore.get<string>(K.GUEST_ID, "")
  if (existing) return existing
  const id = "guest_" + Math.random().toString(36).slice(2, 9)
  SharedStore.set(K.GUEST_ID, id)
  return id
}

// ═════════════════════════════════════════════════════════════════════════════
// Listen Stats
// ═════════════════════════════════════════════════════════════════════════════

function todayKey(): string { return new Date().toISOString().slice(0, 10) }
export function getListenStats(): Record<string, number> { return SharedStore.get<Record<string, number>>(K.LISTEN_STATS, {}) }
export function recordListenSeconds(seconds: number): void {
  const stats = getListenStats()
  const key = todayKey()
  stats[key] = (stats[key] || 0) + seconds
  SharedStore.set(K.LISTEN_STATS, stats)
}
export function getTodayListenSeconds(): number { return getListenStats()[todayKey()] || 0 }
export function getMonthListenSeconds(): number {
  const prefix = new Date().toISOString().slice(0, 7)
  return Object.entries(getListenStats()).filter(([k]) => k.startsWith(prefix)).reduce((a, [, v]) => a + v, 0)
}
export function getAllTimeListenSeconds(): number { return Object.values(getListenStats()).reduce((a, v) => a + v, 0) }
export function getWeekListenData(): { date: string; seconds: number }[] {
  const stats = getListenStats()
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const key = d.toISOString().slice(0, 10)
    return { date: key, seconds: stats[key] || 0 }
  })
}
export function getHeatmapData(): HeatmapDay[] {
  const stats  = getListenStats()
  const result: HeatmapDay[] = []
  const today  = new Date()
  for (let i = 181; i >= 0; i--) {
    const d    = new Date(today); d.setDate(d.getDate() - i)
    const key  = d.toISOString().slice(0, 10)
    const secs = stats[key] || 0
    let level: 0 | 1 | 2 | 3 | 4 = 0
    if      (secs === 0)  level = 0
    else if (secs < 300)  level = 1
    else if (secs < 1200) level = 2
    else if (secs < 3600) level = 3
    else                  level = 4
    result.push({ date: key, seconds: secs, level })
  }
  return result
}
export function fmtListenTime(secs: number): string {
  if (!secs || secs < 1) return "0s"
  if (secs < 60) return `${Math.round(secs)}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}
export function clearListenStats(): void { SharedStore.del(K.LISTEN_STATS) }

// ═════════════════════════════════════════════════════════════════════════════
// Song History
// ═════════════════════════════════════════════════════════════════════════════

export function getSongHistory(): HistoryEntry[] { return SharedStore.get<HistoryEntry[]>(K.HISTORY, []) }
export function getDeduplicatedHistory(): HistoryEntry[] {
  const seen = new Set<string>()
  return getSongHistory().filter(e => { if (seen.has(e.song.id)) return false; seen.add(e.song.id); return true })
}
export function addToSongHistory(song: Song): void {
  SharedStore.set(K.HISTORY, [{ song, playedAt: Date.now() }, ...getSongHistory()].slice(0, MAX_HISTORY))
}
export function clearSongHistory(): void { SharedStore.del(K.HISTORY) }

export function getTopPlayedSongs(period: "day" | "week" | "month", limit = 5): TopSong[] {
  const now = Date.now()
  const cutoff = period === "day" ? now - 86_400_000 : period === "week" ? now - 7 * 86_400_000 : now - 30 * 86_400_000
  const counts = new Map<string, { song: Song; plays: number }>()
  for (const e of getSongHistory()) {
    if (e.playedAt < cutoff) continue
    if (!counts.has(e.song.id)) counts.set(e.song.id, { song: e.song, plays: 0 })
    counts.get(e.song.id)!.plays++
  }
  return [...counts.values()].sort((a, b) => b.plays - a.plays).slice(0, limit)
}
export function getAllTimeTopSongs(limit = 10): TopSong[] {
  const counts = new Map<string, { song: Song; plays: number }>()
  for (const e of getSongHistory()) {
    if (!counts.has(e.song.id)) counts.set(e.song.id, { song: e.song, plays: 0 })
    counts.get(e.song.id)!.plays++
  }
  return [...counts.values()].sort((a, b) => b.plays - a.plays).slice(0, limit)
}

// ═════════════════════════════════════════════════════════════════════════════
// Reactions
// ═════════════════════════════════════════════════════════════════════════════

export function getReactions(songId: string): Reaction[] {
  const all = SharedStore.get<Record<string, Reaction[]>>(K.REACTIONS, {})
  return all[songId] ?? []
}
export function addReaction(songId: string, emoji: string, timestamp: number): void {
  const all = SharedStore.get<Record<string, Reaction[]>>(K.REACTIONS, {})
  if (!all[songId]) all[songId] = []
  all[songId].push({ emoji, timestamp: Math.floor(timestamp), addedAt: Date.now() })
  if (all[songId].length > 200) all[songId] = all[songId].slice(-200)
  SharedStore.set(K.REACTIONS, all)
}
export function clearReactions(songId: string): void {
  const all = SharedStore.get<Record<string, Reaction[]>>(K.REACTIONS, {})
  delete all[songId]
  SharedStore.set(K.REACTIONS, all)
}
// Legacy compat — some components pass the whole map
export function saveReactions(data: Record<string, Reaction[]>): void { SharedStore.set(K.REACTIONS, data) }

// ═════════════════════════════════════════════════════════════════════════════
// Collab Refs
// ═════════════════════════════════════════════════════════════════════════════

export function getCollabRefs(): CollabRef[] { return SharedStore.get<CollabRef[]>(K.COLLAB, []) }
export function saveCollabRef(ref: CollabRef): void {
  SharedStore.set(K.COLLAB, [ref, ...getCollabRefs().filter(r => r.id !== ref.id)].slice(0, 20))
}
// Alias used in some components
export const addCollabRef = saveCollabRef
export function removeCollabRef(id: string): void {
  SharedStore.set(K.COLLAB, getCollabRefs().filter(r => r.id !== id))
}

// ═════════════════════════════════════════════════════════════════════════════
// Top Artists
// ═════════════════════════════════════════════════════════════════════════════

function parseDuration(dur: string): number {
  if (!dur) return 180
  const parts = dur.split(":").map(Number)
  if (parts.length === 2) return (parts[0] || 0) * 60 + (parts[1] || 0)
  if (parts.length === 3) return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0)
  const n = parseInt(dur, 10); return isNaN(n) ? 180 : n
}
type ArtistEntry = { artist: string; plays: number; songs: Map<string, { song: Song; plays: number }> }
function buildArtistMap(history: HistoryEntry[]): Map<string, ArtistEntry> {
  const m = new Map<string, ArtistEntry>()
  for (const e of history) {
    const name = e.song.artist; if (!name) continue
    if (!m.has(name)) m.set(name, { artist: name, plays: 0, songs: new Map() })
    const entry = m.get(name)!; entry.plays++
    if (!entry.songs.has(e.song.id)) entry.songs.set(e.song.id, { song: e.song, plays: 0 })
    entry.songs.get(e.song.id)!.plays++
  }
  return m
}
function artistMapToTopArtists(m: Map<string, ArtistEntry>, limit: number): TopArtist[] {
  return [...m.values()].map(a => {
    const songsArr = [...a.songs.values()]
    const best = songsArr.sort((x, y) => y.plays - x.plays)[0]
    const listenSeconds = songsArr.reduce((sum, s) => sum + s.plays * parseDuration(s.song.duration || ""), 0)
    return { artist: a.artist, thumbnail: best?.song.thumbnail || "", plays: a.plays, listenSeconds: Math.round(listenSeconds), songCount: a.songs.size }
  }).sort((a, b) => b.plays - a.plays).slice(0, limit)
}
export function getTopArtists(period: "day" | "week" | "month", limit = 5): TopArtist[] {
  const now = Date.now()
  const cutoff = period === "day" ? now - 86_400_000 : period === "week" ? now - 7 * 86_400_000 : now - 30 * 86_400_000
  return artistMapToTopArtists(buildArtistMap(getSongHistory().filter(e => e.playedAt >= cutoff)), limit)
}
export function getAllTimeTopArtists(limit = 10): TopArtist[] {
  return artistMapToTopArtists(buildArtistMap(getSongHistory()), limit)
}

// ═════════════════════════════════════════════════════════════════════════════
// Badge Events (delegated to storage-badges, re-exported for compat)
// ═════════════════════════════════════════════════════════════════════════════

export function recordBadgeEvent(type: string, meta?: string): void {
  if (typeof window === "undefined") return
  const evs = SharedStore.get<BadgeEvent[]>(K.BADGE_EVENTS, [])
  evs.unshift({ type, at: Date.now(), meta })
  SharedStore.set(K.BADGE_EVENTS, evs.slice(0, 5000))
}
export function getBadgeEvents(): BadgeEvent[] { return SharedStore.get<BadgeEvent[]>(K.BADGE_EVENTS, []) }

function getEarnedBadgeIdSet(): Set<string> {
  return new Set(SharedStore.get<string[]>(K.BADGE_EARNED, []))
}
function getEarnedBadgeTimes(): Record<string, number> {
  return SharedStore.get<Record<string, number>>(K.BADGE_TIMES, {})
}
export function markBadgeEarned(id: string): void {
  const ids = getEarnedBadgeIdSet(); ids.add(id)
  SharedStore.set(K.BADGE_EARNED, [...ids])
  const times = getEarnedBadgeTimes()
  if (!times[id]) { times[id] = Date.now(); SharedStore.set(K.BADGE_TIMES, times) }
}
export function getEarnedBadgeIds(): string[] { return SharedStore.get<string[]>(K.BADGE_EARNED, []) }

// ═════════════════════════════════════════════════════════════════════════════
// Export / Import all data
// ═════════════════════════════════════════════════════════════════════════════

interface MusicanazBackup {
  version: 1
  exportedAt: number
  data: Record<string, unknown>
}

export function exportAllData(): void {
  if (typeof window === "undefined") return
  try {
    const data: Record<string, unknown> = {}
    for (const key of ALL_SHARED_KEYS) {
      const raw = localStorage.getItem(key)
      if (raw) { try { data[key] = JSON.parse(raw) } catch { data[key] = raw } }
    }
    const backup: MusicanazBackup = { version: 1, exportedAt: Date.now(), data }
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url; a.download = `musicanaz-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click()
    URL.revokeObjectURL(url)
  } catch (e) { console.error("Export failed:", e) }
}

export function importAllData(
  json: string,
  mode: "merge" | "replace" = "replace",
): { ok: boolean; error?: string; keysRestored: number } {
  if (typeof window === "undefined") return { ok: false, error: "Not in browser", keysRestored: 0 }
  try {
    const backup: MusicanazBackup = JSON.parse(json)
    if (!backup?.data || typeof backup.data !== "object")
      return { ok: false, error: "Invalid backup file format", keysRestored: 0 }
    if (backup.version !== 1)
      return { ok: false, error: `Unknown backup version: ${backup.version}`, keysRestored: 0 }

    let keysRestored = 0
    if (mode === "replace") {
      for (const key of ALL_SHARED_KEYS) localStorage.removeItem(key)
    }
    for (const [key, value] of Object.entries(backup.data)) {
      if (!ALL_SHARED_KEYS.includes(key)) continue
      if (mode === "merge") {
        const existing = localStorage.getItem(key)
        if (existing) {
          try {
            const ex = JSON.parse(existing)
            if (Array.isArray(ex) && Array.isArray(value)) {
              const ids = new Set(ex.map((x: any) => x.id || x.videoId))
              localStorage.setItem(key, JSON.stringify([...ex, ...(value as any[]).filter((x: any) => !ids.has(x.id || x.videoId))]))
              keysRestored++; continue
            }
            if (typeof ex === "object" && !Array.isArray(ex) && typeof value === "object" && !Array.isArray(value)) {
              localStorage.setItem(key, JSON.stringify({ ...ex, ...(value as object) }))
              keysRestored++; continue
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

// ═════════════════════════════════════════════════════════════════════════════
// YT Cookies (SAFE tier)
// ═════════════════════════════════════════════════════════════════════════════

export function getEncryptedCookies(): string { return SafeStore.get<string>(SK.YT_COOKIES_ENC, "") }
export function setEncryptedCookies(enc: string): void { SafeStore.set(SK.YT_COOKIES_ENC, enc) }
export function clearEncryptedCookies(): void { SafeStore.del(SK.YT_COOKIES_ENC) }
export function getEncryptionKey(): string { return SafeStore.get<string>(SK.ENC_KEY, "") }
export function setEncryptionKey(key: string): void { SafeStore.set(SK.ENC_KEY, key) }
export function hasCookies(): boolean { return !!getEncryptedCookies() && !!getEncryptionKey() }

// ─── Badge system re-exports ──────────────────────────────────────────────────
export { evaluateBadges, getEarnedBadges, getTotalXP, getXPLevel, ALL_BADGES } from "./storage-badges"
export type { Badge, BadgeStatus, BadgeTier } from "./storage-badges"
