import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp           = request.nextUrl.searchParams
  const videoId      = sp.get("videoId")
  const forceRefresh = sp.get("forceRefresh") === "true"
  const country      = sp.get("country")  || "ZZ"
  const language     = sp.get("language") || "en"
  if (!videoId) return NextResponse.json({ tracks: [], count: 0 }, { status: 400 })
  try {
    const url = `${BASE}/upnext/${encodeURIComponent(videoId)}?limit=20&force_refresh=${forceRefresh}&country=${country}&language=${language}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status}`)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ tracks: [], count: 0 }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const videoId  = sp.get("videoId")
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  if (!videoId) return NextResponse.json({ error: "Missing videoId" }, { status: 400 })
  try {
    await fetch(`${BASE}/upnext/${encodeURIComponent(videoId)}?country=${country}&language=${language}`, { method: "DELETE" })
    return NextResponse.json({ cleared: videoId })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
