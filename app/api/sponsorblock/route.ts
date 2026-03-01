import { type NextRequest, NextResponse } from "next/server"

// SponsorBlock API — get highlight (POI) for a video
// https://wiki.sponsor.ajay.app/w/API_Docs#GET_/api/skipSegments
export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get("videoId")
  if (!videoId) return NextResponse.json({ error: "Missing videoId" }, { status: 400 })

  try {
    // POI (point of highlight) — category=poi_highlight
    const url = `https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(videoId)}&categories=["poi_highlight"]&actionTypes=["poi"]`
    const res = await fetch(url, {
      headers: { "User-Agent": "Musicanaz/1.0" },
      next: { revalidate: 3600 }, // cache 1hr
    })

    if (res.status === 404) {
      return NextResponse.json({ highlight: null, found: false })
    }
    if (!res.ok) throw new Error(`${res.status}`)

    const data = await res.json()
    // data is an array of segments; poi_highlight has segment: [time, time] (same time = point)
    const poi = Array.isArray(data) && data.length > 0 ? data[0] : null
    if (!poi) return NextResponse.json({ highlight: null, found: false })

    const time = poi.segment?.[0] ?? null
    return NextResponse.json({
      found: time !== null,
      highlight: time,
      videoDuration: poi.videoDuration,
      votes: poi.votes,
    })
  } catch {
    return NextResponse.json({ highlight: null, found: false })
  }
}
