import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const id    = request.nextUrl.searchParams.get("id")
  const limit = request.nextUrl.searchParams.get("limit") || "500"
  if (!id) return NextResponse.json({ songs: [], total: 0, albums: [] }, { status: 400 })
  try {
    const res  = await fetch(`${BASE}/artist/${encodeURIComponent(id)}/songs?limit=${limit}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json({
      songs:  data.songs  || [],
      total:  data.total  || 0,
      name:   data.name   || "",
      albums: data.albums || [],
    })
  } catch {
    return NextResponse.json({ songs: [], total: 0, albums: [] }, { status: 500 })
  }
}
