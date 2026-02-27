import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId")
  const limit   = request.nextUrl.searchParams.get("limit") || "10"
  if (!videoId) return NextResponse.json({ error: "Missing videoId" }, { status: 400 })
  try {
    const res  = await fetch(`${BASE}/now_playing/${encodeURIComponent(videoId)}?related_limit=${limit}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json(data) // { stream, related, videoId }
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 500 })
  }
}
