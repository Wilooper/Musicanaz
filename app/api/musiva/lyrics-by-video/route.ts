import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId")
  if (!videoId) return NextResponse.json({ error: "Missing videoId" }, { status: 400 })
  try {
    const res  = await fetch(`${BASE}/lyrics_by_video/${encodeURIComponent(videoId)}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json(data) // { lyricsId, lyrics } or { error }
  } catch {
    return NextResponse.json({ lyricsId: null, error: "Lyrics unavailable" }, { status: 500 })
  }
}
