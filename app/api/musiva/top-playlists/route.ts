import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const country  = sp.get("country")  || "ZZ"
  const limit    = sp.get("limit")    || "16"
  const language = sp.get("language") || "en"
  try {
    const res = await fetch(`${BASE}/top_playlists?country=${country}&limit=${limit}&language=${language}`)
    if (!res.ok) throw new Error(`${res.status}`)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json([])
  }
}
