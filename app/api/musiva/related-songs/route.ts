import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId")
  const limit   = request.nextUrl.searchParams.get("limit") || "15"
  if (!videoId) return NextResponse.json({ tracks: [], count: 0 }, { status: 400 })
  try {
    const res  = await fetch(`${BASE}/related_songs/${encodeURIComponent(videoId)}?limit=${limit}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json(data) // { videoId, tracks, count }
  } catch {
    return NextResponse.json({ tracks: [], count: 0 }, { status: 500 })
  }
}
