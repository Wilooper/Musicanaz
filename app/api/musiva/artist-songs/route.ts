import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const id       = sp.get("id")
  const limit    = sp.get("limit")    || "20"
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  if (!id) return NextResponse.json({ songs: [], total: 0, albums: [] }, { status: 400 })
  try {
    const res = await fetch(
      `${BASE}/artist/${encodeURIComponent(id)}/songs?limit=${limit}&country=${country}&language=${language}`
    )
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
