import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId")
  const forceRefresh = request.nextUrl.searchParams.get("forceRefresh") === "true"
  if (!videoId) return NextResponse.json({ tracks: [], count: 0 }, { status: 400 })
  try {
    const url = `${BASE}/upnext/${encodeURIComponent(videoId)}?limit=20${forceRefresh ? "&force_refresh=true" : ""}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ tracks: [], count: 0 }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId")
  if (!videoId) return NextResponse.json({ error: "Missing videoId" }, { status: 400 })
  try {
    await fetch(`${BASE}/upnext/${encodeURIComponent(videoId)}`, { method: "DELETE" })
    return NextResponse.json({ cleared: videoId })
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
