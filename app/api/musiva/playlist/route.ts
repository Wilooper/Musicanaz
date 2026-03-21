import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const id       = sp.get("id")
  const limit    = sp.get("limit")    || "100"
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    const res = await fetch(`${BASE}/playlist/${encodeURIComponent(id)}?limit=${limit}&country=${country}&language=${language}`)
    if (!res.ok) throw new Error(`${res.status}`)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "Playlist unavailable" }, { status: 500 })
  }
}
