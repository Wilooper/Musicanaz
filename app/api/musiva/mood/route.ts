import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const params   = sp.get("params")
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  try {
    if (params) {
      const res = await fetch(`${BASE}/mood_playlists/${params}?country=${country}&language=${language}`, { next: { revalidate: 600 } })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      const cleaned = list.map((p: any) => ({
        browseId:   p.browseId || p.playlistId || "",
        title:      p.title || "",
        subtitle:   p.subtitle || "",
        thumbnail:  p.thumbnail || (Array.isArray(p.thumbnails) && p.thumbnails[0]?.url) || "",
        thumbnails: p.thumbnails || [],
      })).filter((p: any) => p.browseId && p.title)
      return NextResponse.json(cleaned)
    } else {
      const res = await fetch(`${BASE}/mood_categories?country=${country}&language=${language}`, { next: { revalidate: 1800 } })
      if (!res.ok) throw new Error(`${res.status}`)
      const data = await res.json()
      return NextResponse.json((Array.isArray(data) ? data : []).filter((c: any) => c.params && c.title))
    }
  } catch {
    return NextResponse.json([], { status: 500 })
  }
}
