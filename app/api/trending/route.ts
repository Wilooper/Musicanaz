import { type NextRequest, NextResponse } from "next/server"
import { fetchTrendingSongs, fetchTrendingArtists } from "@/lib/toplay-client"

const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

interface NormTrack {
  videoId: string; title: string; artist: string
  thumbnail: string; duration: string; album: string; source?: string
}

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const limit    = sp.get("limit")    || "25"
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  const source   = sp.get("source")
  const type     = sp.get("type")

  if (source === "toplay" && type === "artists") {
    const data = await fetchTrendingArtists({ limit: Number(limit) })
    if (!data) return NextResponse.json({ error: "Failed", artists: [], count: 0 }, { status: 502 })
    return NextResponse.json({ artists: data.artists, count: data.total })
  }
  if (source === "toplay") {
    const data = await fetchTrendingSongs({ limit: Number(limit) })
    if (!data) return NextResponse.json({ error: "Failed", trending: [], count: 0 }, { status: 502 })
    return NextResponse.json({ trending: data.songs, count: data.total })
  }

  try {
    const cap = Math.min(Number(limit), 100)
    const res = await fetch(
      `${BASE}/trending?country=${country}&language=${language}&limit=${cap}&sources=all`,
      { next: { revalidate: 600 } }
    )
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()

    // Read data.merged — already deduplicated across all 4 sources by the server
    // Fall back to individual source arrays if merged is empty
    const raw: any[] = (
      data.merged?.length     ? data.merged     :
      data.apple_top?.length  ? data.apple_top  :
      data.trending?.length   ? data.trending   :
      data.deezer_top?.length ? data.deezer_top :
      []
    )

    const trending: NormTrack[] = raw.slice(0, cap).map((t: any) => ({
      videoId:   t.videoId   || "",
      title:     t.title     || "Unknown",
      artist:    Array.isArray(t.artists)
        ? t.artists.map((a: any) => typeof a === "string" ? a : a?.name).filter(Boolean).join(", ")
        : (t.artist || "Unknown"),
      thumbnail: t.thumbnail || t.thumbnails?.[0]?.url || "",
      duration:  t.duration  || "",
      album:     t.album     || "",
      source:    t.source    || "",
    }))

    // Merge toplay community songs non-blocking
    let toplaySongs: NormTrack[] = []
    try {
      const td = await fetchTrendingSongs({ limit: 10 })
      if (td?.songs?.length) toplaySongs = td.songs.map(s => ({
        videoId: s.songId, title: s.title, artist: s.artist,
        thumbnail: s.albumArt || "", duration: s.duration ? String(s.duration) : "",
        album: "", source: "toplay",
      }))
    } catch {}

    const merged = [...trending, ...toplaySongs]
    return NextResponse.json({ trending: merged, count: merged.length })
  } catch {
    return NextResponse.json({ error: "Failed to fetch trending", trending: [], count: 0 }, { status: 500 })
  }
}
