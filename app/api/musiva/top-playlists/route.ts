import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get("country") || "ZZ"
  const limit   = request.nextUrl.searchParams.get("limit")   || "16"
  try {
    const res  = await fetch(`${BASE}/top_playlists?country=${country}&limit=${limit}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch {
    return NextResponse.json([])
  }
}
