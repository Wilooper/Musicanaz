import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const id    = request.nextUrl.searchParams.get("id")
  const limit = request.nextUrl.searchParams.get("limit") || "100"
  if (!id) return NextResponse.json({ songs: [], total: 0 }, { status: 400 })
  try {
    const res  = await fetch(`${BASE}/artist/${encodeURIComponent(id)}/songs?limit=${limit}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    // v4 returns { songs: [...], total: N, artistId, name }
    return NextResponse.json({
      songs:  data.songs  || [],
      total:  data.total  || 0,
      name:   data.name   || "",
    })
  } catch {
    return NextResponse.json({ songs: [], total: 0 }, { status: 500 })
  }
}
