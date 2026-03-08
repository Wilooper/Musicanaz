import type {
  TopSongSubmission,
  TopArtistSubmission,
  TrendingSong,
  TrendingArtist,
  TrendingSongsResponse,
  TrendingArtistsResponse,
  ToplayStatus,
} from "./toplay-types"

const BASE_URL = process.env.NEXT_PUBLIC_TOPLAY_API_URL || ""

export async function submitTopSongs(
  uid: string,
  songs: TopSongSubmission[]
): Promise<void> {
  if (!BASE_URL) return
  const res = await fetch(`${BASE_URL}/api/user/top-songs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, topSongs: songs }),
  })
  if (!res.ok) {
    throw new Error(`submitTopSongs failed: ${res.status}`)
  }
}

export async function submitTopArtists(
  uid: string,
  artists: TopArtistSubmission[]
): Promise<void> {
  if (!BASE_URL) return
  const res = await fetch(`${BASE_URL}/api/user/top-artists`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid, topArtists: artists }),
  })
  if (!res.ok) {
    throw new Error(`submitTopArtists failed: ${res.status}`)
  }
}

export async function fetchTrendingSongs(options?: {
  limit?: number
  page?: number
  genre?: string
}): Promise<TrendingSongsResponse | null> {
  if (!BASE_URL) return null
  try {
    const params = new URLSearchParams()
    if (options?.limit != null) params.set("limit", String(options.limit))
    if (options?.page != null) params.set("page", String(options.page))
    if (options?.genre) params.set("genre", options.genre)
    const query = params.toString() ? `?${params.toString()}` : ""
    const res = await fetch(`${BASE_URL}/api/trending/songs${query}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return (await res.json()) as TrendingSongsResponse
  } catch {
    return null
  }
}

export async function fetchTrendingSong(
  songId: string
): Promise<TrendingSong | null> {
  if (!BASE_URL) return null
  try {
    const res = await fetch(
      `${BASE_URL}/api/trending/songs/${encodeURIComponent(songId)}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    return (await res.json()) as TrendingSong
  } catch {
    return null
  }
}

export async function fetchTrendingArtists(options?: {
  limit?: number
  page?: number
}): Promise<TrendingArtistsResponse | null> {
  if (!BASE_URL) return null
  try {
    const params = new URLSearchParams()
    if (options?.limit != null) params.set("limit", String(options.limit))
    if (options?.page != null) params.set("page", String(options.page))
    const query = params.toString() ? `?${params.toString()}` : ""
    const res = await fetch(`${BASE_URL}/api/trending/artists${query}`, {
      next: { revalidate: 300 },
    })
    if (!res.ok) return null
    return (await res.json()) as TrendingArtistsResponse
  } catch {
    return null
  }
}

export async function fetchTrendingArtist(
  artistId: string
): Promise<TrendingArtist | null> {
  if (!BASE_URL) return null
  try {
    const res = await fetch(
      `${BASE_URL}/api/trending/artists/${encodeURIComponent(artistId)}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return null
    return (await res.json()) as TrendingArtist
  } catch {
    return null
  }
}

export async function fetchApiStatus(): Promise<ToplayStatus | null> {
  if (!BASE_URL) return null
  try {
    const res = await fetch(`${BASE_URL}/api/status`, {
      next: { revalidate: 60 },
    })
    if (!res.ok) return null
    return (await res.json()) as ToplayStatus
  } catch {
    return null
  }
}
