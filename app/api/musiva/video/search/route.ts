import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const q        = sp.get("q")
  const limit    = sp.get("limit")    || "20"
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  if (!q) return NextResponse.json({ error: "Missing q" }, { status: 400 })
  try {
    const res = await fetch(`${BASE}/search?query=${encodeURIComponent(q)}&filter=videos&limit=${limit}&country=${country}&language=${language}`)
    if (!res.ok) throw new Error(`${res.status}`)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "Video search failed", videos: [] }, { status: 500 })
  }
}
