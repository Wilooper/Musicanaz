import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const albumId  = sp.get("id")
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  if (!albumId) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    const res = await fetch(`${BASE}/album/${encodeURIComponent(albumId)}?country=${country}&language=${language}`)
    if (!res.ok) throw new Error(`${res.status}`)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "Album unavailable" }, { status: 500 })
  }
}
