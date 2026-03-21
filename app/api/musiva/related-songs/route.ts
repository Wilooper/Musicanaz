import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const videoId  = sp.get("videoId")
  const limit    = sp.get("limit")    || "15"
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  if (!videoId) return NextResponse.json({ tracks: [], count: 0 }, { status: 400 })
  try {
    const res = await fetch(`${BASE}/related_songs/${encodeURIComponent(videoId)}?limit=${limit}&country=${country}&language=${language}`)
    if (!res.ok) throw new Error(`${res.status}`)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ tracks: [], count: 0 }, { status: 500 })
  }
}
