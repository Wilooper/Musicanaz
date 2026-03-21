import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const artistId = sp.get("id")
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  if (!artistId) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    const res = await fetch(`${BASE}/artist/${encodeURIComponent(artistId)}?country=${country}&language=${language}`)
    if (!res.ok) throw new Error(`${res.status}`)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "Artist unavailable" }, { status: 500 })
  }
}
