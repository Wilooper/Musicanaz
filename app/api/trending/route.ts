import { type NextRequest, NextResponse } from "next/server"

const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit   = searchParams.get("limit") || "20"
  const country = searchParams.get("country") || "IN"

  try {
    // Use own mpyapi /trending endpoint with country support
    const res = await fetch(
      `${BASE}/trending?country=${country}&limit=${limit}`,
      { next: { revalidate: 600 } }
    )
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()

    // Normalize to match what the old API returned
    const trending = (data.trending || []).map((t: any) => ({
      videoId:   t.videoId   || "",
      title:     t.title     || "Unknown",
      artist:    Array.isArray(t.artists)
        ? t.artists.map((a: any) => (typeof a === "string" ? a : a?.name)).filter(Boolean).join(", ")
        : (t.artist || "Unknown"),
      thumbnail: t.thumbnail || t.thumbnails?.[0]?.url || "",
      duration:  t.duration  || "",
      album:     t.album     || "",
    }))

    return NextResponse.json({ trending, count: trending.length })
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
