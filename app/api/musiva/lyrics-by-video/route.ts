import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const videoId  = sp.get("videoId")
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  if (!videoId) return NextResponse.json({ error: "Missing videoId" }, { status: 400 })
  try {
    const res = await fetch(`${BASE}/lyrics_by_video/${encodeURIComponent(videoId)}?country=${country}&language=${language}`)
    if (!res.ok) throw new Error(`${res.status}`)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ lyricsId: null, error: "Lyrics unavailable" }, { status: 500 })
  }
}
