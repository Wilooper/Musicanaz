import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ albums: [], totalAlbums: 0, totalTracks: 0 }, { status: 400 })
  try {
    const res = await fetch(`${BASE}/artist/${encodeURIComponent(id)}/albums`, {
      next: { revalidate: 600 },
    })
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json({
      artistId:    data.artistId    || id,
      name:        data.name        || "",
      albums:      data.albums      || [],
      totalAlbums: data.totalAlbums || 0,
      totalTracks: data.totalTracks || 0,
    })
  } catch {
    return NextResponse.json({ albums: [], totalAlbums: 0, totalTracks: 0 }, { status: 500 })
  }
}
