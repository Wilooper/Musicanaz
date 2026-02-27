import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  try {
    const country = request.nextUrl.searchParams.get("country") || "ZZ"
    const controller = new AbortController()
    const tid = setTimeout(() => controller.abort(), 15000)
    const res = await fetch(`${BASE}/charts?country=${country}`, { signal: controller.signal, next: { revalidate: 600 } })
    clearTimeout(tid)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    // New backend returns { songs:[], videos:[], artists:[], trending:[] }
    // Each item already normalised with thumbnail string at top level
    return NextResponse.json({
      songs:    Array.isArray(data.songs)    ? data.songs    : [],
      videos:   Array.isArray(data.videos)   ? data.videos   : [],
      artists:  Array.isArray(data.artists)  ? data.artists  : [],
      trending: Array.isArray(data.trending) ? data.trending : [],
    })
  } catch (e) {
    return NextResponse.json({ songs: [], videos: [], artists: [], trending: [] })
  }
}
