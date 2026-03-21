import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

// Last.fm top artists — country-aware
export async function GET(request: NextRequest) {
  const sp      = request.nextUrl.searchParams
  const country = sp.get("country") || "ZZ"
  const limit   = Math.min(Number(sp.get("limit") || "20"), 50)
  try {
    const res = await fetch(
      `${BASE}/lastfm/artists?country=${country}&limit=${limit}`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) throw new Error(`${res.status}`)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ artists: [], count: 0 }, { status: 500 })
  }
}
