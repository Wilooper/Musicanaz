import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params
  try {
    // Try as playlist first (strip VL prefix if present for safety)
    const cleanId = videoId.toUpperCase().startsWith("VL") ? videoId.slice(2) : videoId
    const res = await fetch(`${BASE}/playlist/${encodeURIComponent(cleanId)}?limit=100`)
    if (res.ok) {
      const data = await res.json()
      return NextResponse.json(data)
    }
    // Fallback: try original ID
    const res2 = await fetch(`${BASE}/playlist/${encodeURIComponent(videoId)}?limit=100`)
    if (res2.ok) {
      const data = await res2.json()
      return NextResponse.json(data)
    }
    // Final fallback: song metadata
    const songRes = await fetch(`${BASE}/song/${encodeURIComponent(videoId)}`)
    const songData = await songRes.json()
    return NextResponse.json(songData)
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 500 })
  }
}
