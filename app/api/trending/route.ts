import { type NextRequest, NextResponse } from "next/server"
import { fetchTrendingSongs, fetchTrendingArtists } from "@/lib/toplay-client"

interface NormalizedTrendingItem {
  videoId: string
  title: string
  artist: string
  thumbnail: string
  duration: string
  album: string
  _source?: string
}

const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit   = searchParams.get("limit") || "20"
  const country = searchParams.get("country") || "IN"
  const source  = searchParams.get("source")
  const type    = searchParams.get("type")

  // ?source=toplay&type=artists — return only toplay trending artists
  if (source === "toplay" && type === "artists") {
    const data = await fetchTrendingArtists({ limit: Number(limit) })
    if (!data) {
      return NextResponse.json({ error: "Failed to fetch trending artists", artists: [], count: 0 }, { status: 502 })
    }
    return NextResponse.json({ artists: data.artists, count: data.total })
  }

  // ?source=toplay — return only toplay trending songs
  if (source === "toplay") {
    const data = await fetchTrendingSongs({ limit: Number(limit) })
    if (!data) {
      return NextResponse.json({ error: "Failed to fetch trending songs from toplay", trending: [], count: 0 }, { status: 502 })
    }
    return NextResponse.json({ trending: data.songs, count: data.total })
  }

  // Default: fetch from turbo API, optionally merge with toplay community data
  try {
    // Use own mpyapi /trending endpoint with country support
    const res = await fetch(
      `${BASE}/trending?country=${country}&limit=${limit}`,
      { next: { revalidate: 600 } }
    )
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()

    // Normalize to match what the old API returned
    const trending: NormalizedTrendingItem[] = (data.trending || []).map((t: any) => ({
      videoId:   t.videoId   || "",
      title:     t.title     || "Unknown",
      artist:    Array.isArray(t.artists)
        ? t.artists.map((a: any) => (typeof a === "string" ? a : a?.name)).filter(Boolean).join(", ")
        : (t.artist || "Unknown"),
      thumbnail: t.thumbnail || t.thumbnails?.[0]?.url || "",
      duration:  t.duration  || "",
      album:     t.album     || "",
    }))

    // Optionally merge toplay community trending (non-blocking)
    let toplaySongs: NormalizedTrendingItem[] = []
    try {
      const toplayData = await fetchTrendingSongs({ limit: 10 })
      if (toplayData?.songs?.length) {
        toplaySongs = toplayData.songs.map((s) => ({
          videoId:   s.songId,
          title:     s.title,
          artist:    s.artist,
          thumbnail: s.albumArt || "",
          duration:  s.duration ? String(s.duration) : "",
          album:     "",
          _source:   "toplay",
        }))
      }
    } catch {
      // ignore toplay errors
    }

    const merged: NormalizedTrendingItem[] = [...trending, ...toplaySongs]
    return NextResponse.json({ trending: merged, count: merged.length })
  } catch {
    // Fallback to /charts if /trending fails
    try {
      const res = await fetch(
        `${BASE}/charts?country=${country}`,
        { next: { revalidate: 600 } }
      )
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const songs = (data.trending || data.songs || []).slice(0, Number(limit))
      return NextResponse.json({ trending: songs, count: songs.length })
    } catch {
      return NextResponse.json({ error: "Failed to fetch trending songs", trending: [], count: 0 }, { status: 500 })
    }
  }
}
