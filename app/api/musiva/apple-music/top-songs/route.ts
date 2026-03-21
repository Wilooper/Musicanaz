import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

// Apple Music top songs via MUSIVA proxy — country-aware, no Apple API key needed
export async function GET(request: NextRequest) {
  const sp      = request.nextUrl.searchParams
  const country = sp.get("country") || "us"
  const limit   = Math.min(Number(sp.get("limit") || "50"), 100)
  try {
    const res = await fetch(
      `${BASE}/apple_music/top_songs?country=${country.toLowerCase()}&limit=${limit}`,
      { next: { revalidate: 1800 } }
    )
    if (!res.ok) throw new Error(`${res.status}`)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ songs: [], count: 0 }, { status: 500 })
  }
}
