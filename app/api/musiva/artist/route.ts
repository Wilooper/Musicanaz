import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const artistId = request.nextUrl.searchParams.get("id")
  if (!artistId) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    const res = await fetch(`${BASE}/artist/${encodeURIComponent(artistId)}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Artist unavailable" }, { status: 500 })
  }
}
