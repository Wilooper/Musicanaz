import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const q        = sp.get("q")
  const filter   = sp.get("filter")  || "songs"
  const limit    = sp.get("limit")   || "20"
  const offset   = sp.get("offset")  || "0"
  const country  = sp.get("country") || "ZZ"
  const language = sp.get("language") || "en"
  if (!q) return NextResponse.json({ results: [], count: 0, hasMore: false })
  try {
    const url = `${BASE}/search?query=${encodeURIComponent(q)}&filter=${filter}&limit=${limit}&offset=${offset}&country=${country}&language=${language}`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()

    // Backend returns a raw array, NOT { results: [] }
    const results = Array.isArray(data) ? data : (data.results || [])
    const lim     = Number(limit)
    return NextResponse.json({
      results,
      count:   results.length,
      hasMore: results.length >= lim,  // if we got a full page, there may be more
      total:   data.total || results.length,
    })
  } catch {
    return NextResponse.json({ results: [], count: 0, hasMore: false }, { status: 500 })
  }
}
