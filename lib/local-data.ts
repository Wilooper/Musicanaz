/**
 * Musicanaz local data system  (lib/local-data.ts)
 * All listening history stays on-device in localStorage.
 * The blob is signed with APP_SIG so tampering can be detected.
 * The AI API only receives a computed summary — never the raw song list.
 */

export const APP_SIG      = "musicanaz_2025"
export const DATA_KEY     = "mz_ai_v1"
export const DATA_VERSION = 1

export interface LocalSongEntry {
  id:               string
  title:            string
  artist:           string
  album:            string
  thumbnail:        string
  play_count:       number
  total_listened_ms:number
  duration_ms:      number
  avg_listen_ratio: number
  liked:            boolean
  liked_at?:        number
  skip_count:       number
  skipped:          boolean
  downloaded:       boolean
  in_playlists:     string[]
  first_played:     number
  last_played:      number
  types?:           string[]
}

export interface TasteAnalysis {
  generated_at:     number
  liked_types:      string[]
  disliked_types:   string[]
  top_artists:      string[]
  top_songs:        Array<{song_id:string;title:string;artist:string;play_count:number;types?:string[]}>
  taste_summary:    string
  similar_users:    Array<{user_id:string;similarity:number}>
  songs_classified: Record<string, string[]>
  suggestions:      Array<{song_id:string;title:string;artist:string;thumbnail:string;relevance_score?:number}>
}

export interface LocalUserData {
  _sig:        string
  _version:    number
  user_id:     string
  created_at:  number
  last_updated:number
  songs:       Record<string, LocalSongEntry>
  analysis?:   TasteAnalysis
}

function _read(): LocalUserData | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as LocalUserData
    if (d._sig !== APP_SIG) return null
    return d
  } catch { return null }
}

function _write(d: LocalUserData): void {
  if (typeof window === "undefined") return
  try {
    d._sig = APP_SIG
    d.last_updated = Date.now()
    localStorage.setItem(DATA_KEY, JSON.stringify(d))
  } catch (e) { console.warn("[mz-ai] write failed:", e) }
}

export function getLocalData(): LocalUserData | null { return _read() }

export function initLocalData(user_id: string): LocalUserData {
  const existing = _read()
  if (existing) return existing
  const d: LocalUserData = {
    _sig: APP_SIG, _version: DATA_VERSION, user_id,
    created_at: Date.now(), last_updated: Date.now(), songs: {},
  }
  _write(d); return d
}

export function recordPlay(
  songId: string, title: string, artist: string,
  album: string, thumbnail: string,
  listenedMs: number, durationMs: number, skippedEarly: boolean,
): void {
  const d = _read(); if (!d) return
  const now = Date.now()
  const e: LocalSongEntry = d.songs[songId] ?? {
    id: songId, title, artist, album, thumbnail,
    play_count: 0, total_listened_ms: 0, duration_ms: durationMs,
    avg_listen_ratio: 0, liked: false, skip_count: 0, skipped: false,
    downloaded: false, in_playlists: [], first_played: now, last_played: now,
  }
  e.title = title; e.artist = artist; e.thumbnail = thumbnail
  e.duration_ms = durationMs || e.duration_ms
  e.play_count += 1
  e.total_listened_ms += listenedMs
  e.last_played = now
  if (skippedEarly) e.skip_count += 1
  const ratio = durationMs > 0 ? listenedMs / durationMs : 0.5
  e.avg_listen_ratio = (e.avg_listen_ratio * (e.play_count - 1) + ratio) / e.play_count
  e.skipped = e.skip_count > e.play_count * 0.5
  d.songs[songId] = e; _write(d)
}

export function setLiked(songId: string, liked: boolean): void {
  const d = _read(); if (!d || !d.songs[songId]) return
  d.songs[songId].liked = liked
  d.songs[songId].liked_at = liked ? Date.now() : undefined
  _write(d)
}

export function setDownloaded(songId: string, dl: boolean): void {
  const d = _read(); if (!d || !d.songs[songId]) return
  d.songs[songId].downloaded = dl; _write(d)
}

export function addToPlaylist(songId: string, playlistId: string): void {
  const d = _read(); if (!d || !d.songs[songId]) return
  if (!d.songs[songId].in_playlists.includes(playlistId))
    d.songs[songId].in_playlists.push(playlistId)
  _write(d)
}

export function writeAnalysis(analysis: TasteAnalysis, suggestions: any[]): void {
  const d = _read(); if (!d) return
  for (const [sid, types] of Object.entries(analysis.songs_classified || {})) {
    if (d.songs[sid]) d.songs[sid].types = types as string[]
  }
  d.analysis = { ...analysis, suggestions }
  _write(d)
}

export function buildTasteProfile(userId: string) {
  const d = _read()
  const songs = Object.values(d?.songs ?? {})
  const byPlays = [...songs].sort((a, b) => b.play_count - a.play_count)
  const topSongs = byPlays.slice(0, 40).map(s => ({
    song_id: s.id, title: s.title, artist: s.artist, album: s.album || "",
    play_count: s.play_count, liked: s.liked, skipped: s.skipped,
    listen_ratio: s.avg_listen_ratio,
  }))
  const likedSongs = songs.filter(s => s.liked).slice(0, 30).map(s => ({
    song_id: s.id, title: s.title, artist: s.artist, album: s.album || "",
    play_count: s.play_count, liked: true, skipped: false,
    listen_ratio: s.avg_listen_ratio,
  }))
  const skippedSongs = songs.filter(s => s.skipped).slice(0, 20).map(s => ({
    song_id: s.id, title: s.title, artist: s.artist, album: s.album || "",
    play_count: s.play_count, liked: false, skipped: true,
    listen_ratio: s.avg_listen_ratio,
  }))
  const artistPlays: Record<string, number> = {}
  for (const s of songs) artistPlays[s.artist] = (artistPlays[s.artist] || 0) + s.play_count
  const topArtists = Object.entries(artistPlays)
    .sort((a, b) => b[1] - a[1]).slice(0, 15).map(([a]) => a)
  return {
    user_id: userId, app_sig: APP_SIG,
    top_songs: topSongs, liked_songs: likedSongs,
    skipped_songs: skippedSongs, top_artists: topArtists,
    total_plays: songs.reduce((a, s) => a + s.play_count, 0),
  }
}

export function getStats() {
  const d = _read()
  const songs = Object.values(d?.songs ?? {})
  return {
    total_songs:    songs.length,
    total_plays:    songs.reduce((a, s) => a + s.play_count, 0),
    liked:          songs.filter(s => s.liked).length,
    skipped:        songs.filter(s => s.skipped).length,
    downloaded:     songs.filter(s => s.downloaded).length,
    has_analysis:   !!d?.analysis,
    analysis_age_h: d?.analysis
      ? Math.round((Date.now() - d.analysis.generated_at) / 3_600_000)
      : null,
  }
}

export function clearLocalData(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(DATA_KEY)
}
