import { type NextRequest, NextResponse } from "next/server"

const BASE     = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams.get("params")
  try {
    if (params) {
      // Fetch mood playlists for a given params token
      // params token must NOT be re-encoded — pass raw to backend
      const res = await fetch(`${BASE}/mood_playlists/${params}`, { next: { revalidate: 600 } })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      // Ensure every item has a usable browseId
      const cleaned = list.map((p: any) => ({
        browseId:   p.browseId || p.playlistId || "",
        title:      p.title || "",
        subtitle:   p.subtitle || "",
        thumbnail:  p.thumbnail || (Array.isArray(p.thumbnails) && p.thumbnails[0]?.url) || "",
        thumbnails: p.thumbnails || [],
      })).filter((p: any) => p.browseId && p.title)
      return NextResponse.json(cleaned)
    } else {
      // Fetch mood categories
      const res = await fetch(`${BASE}/mood_categories`, { next: { revalidate: 1800 } })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      return NextResponse.json(list.filter((c: any) => c.params && c.title))
    }
  } catch (e) {
    return NextResponse.json([], { status: 500 })
  }
}
