import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp     = request.nextUrl.searchParams
  const q      = sp.get("q")
  const filter = sp.get("filter") || "songs"
  const limit  = parseInt(sp.get("limit")  || "20")
  const offset = parseInt(sp.get("offset") || "0")

  if (!q) return NextResponse.json({ results: [], count: 0, hasMore: false })

  try {
    // v4 backend owns pagination: pass offset+limit directly, DON'T re-slice
    const url  = `${BASE}/search?query=${encodeURIComponent(q)}&filter=${filter}&limit=${limit}&offset=${offset}`
    const res  = await fetch(url)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    // Backend returns { results, count, total, hasMore, offset, limit }
    // Just pass it through — no re-normalization needed (v4 normalizes server-side)
    return NextResponse.json({
      results: data.results || [],
      count:   data.count   || 0,
      hasMore: data.hasMore ?? false,
      total:   data.total   || 0,
    })
  } catch {
    return NextResponse.json({ results: [], count: 0, hasMore: false }, { status: 500 })
  }
}
