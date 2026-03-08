import type { Song } from "./types"
import { getRecentlyPlayed, getLikedSongs } from "./storage"
import { getOrCreateUID } from "./uid"
import { submitTopSongs, submitTopArtists } from "./toplay-client"
import type { TopSongSubmission, TopArtistSubmission } from "./toplay-types"

const LAST_SYNC_KEY = "musicanaz_last_toplay_sync"
const SYNC_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

function shouldSync(): boolean {
  if (typeof window === "undefined") return false
  try {
    const last = localStorage.getItem(LAST_SYNC_KEY)
    if (!last) return true
    return Date.now() - Number(last) >= SYNC_INTERVAL_MS
  } catch {
    return true
  }
}

function markSynced(): void {
  try {
    localStorage.setItem(LAST_SYNC_KEY, String(Date.now()))
  } catch {
    // ignore
  }
}

function songToTopSongSubmission(song: Song, playCount: number): TopSongSubmission {
  return {
    songId: song.id,
    title: song.title,
    artist: song.artist,
    albumArt: song.thumbnail || undefined,
    playCount,
  }
}

// Weight applied to liked songs to reflect stronger user preference
const LIKED_SONG_WEIGHT = 2

function deriveTopArtists(songs: Song[]): TopArtistSubmission[] {
  // Use the artist name as a canonical key; songs from Musicanaz don't carry
  // a separate artistId, so we normalise the name to a stable slug. This is
  // best-effort — different name spellings for the same artist will appear as
  // separate entries, but it avoids cross-artist collisions for the common case.
  const artistMap = new Map<string, { name: string; listenCount: number }>()

  for (const song of songs) {
    const artistId = song.artist.trim().toLowerCase().replace(/\s+/g, "-")
    const existing = artistMap.get(artistId)
    if (existing) {
      existing.listenCount += 1
    } else {
      artistMap.set(artistId, { name: song.artist, listenCount: 1 })
    }
  }

  return Array.from(artistMap.entries()).map(([artistId, data]) => ({
    artistId,
    name: data.name,
    listenCount: data.listenCount,
  }))
}

export async function syncUserDataToToplay(): Promise<void> {
  if (typeof window === "undefined") return
  if (!shouldSync()) return

  try {
    const uid = getOrCreateUID()
    if (!uid) return

    const recentSongs = getRecentlyPlayed()
    const likedSongs = getLikedSongs()

    // Build a play-count map: liked songs count double
    const countMap = new Map<string, { song: Song; count: number }>()
    for (const song of recentSongs) {
      const entry = countMap.get(song.id)
      if (entry) {
        entry.count += 1
      } else {
        countMap.set(song.id, { song, count: 1 })
      }
    }
    for (const song of likedSongs) {
      const entry = countMap.get(song.id)
      if (entry) {
        entry.count += LIKED_SONG_WEIGHT
      } else {
        countMap.set(song.id, { song, count: LIKED_SONG_WEIGHT })
      }
    }

    if (countMap.size === 0) return

    const topSongs: TopSongSubmission[] = Array.from(countMap.values()).map(
      ({ song, count }) => songToTopSongSubmission(song, count)
    )

    const allSongs = Array.from(countMap.values()).map(({ song }) => song)
    const topArtists = deriveTopArtists(allSongs)

    await Promise.all([
      submitTopSongs(uid, topSongs),
      submitTopArtists(uid, topArtists),
    ])

    markSynced()
  } catch {
    // fail silently — never break the user experience
  }
}
