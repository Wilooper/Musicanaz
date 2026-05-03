/**
 * app/api/musiva/video-info/route.ts
 * Returns lightweight metadata (title, artist, thumbnail) for a videoId.
 * Used when a song is played via a raw YouTube link with no metadata in URL params.
 */

import { type NextRequest, NextResponse } from "next/server"

const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const id       = request.nextUrl.searchParams.get("id") ?? ""
  const country  = request.nextUrl.searchParams.get("country")  ?? "ZZ"
  const language = request.nextUrl.searchParams.get("language") ?? "en"

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  try {
    const res = await fetch(
      `${BASE}/video_info/${encodeURIComponent(id)}?country=${country}&language=${language}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) {
      return NextResponse.json({ error: "not found" }, { status: res.status })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "error" }, { status: 500 })
  }
}
