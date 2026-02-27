import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const id    = request.nextUrl.searchParams.get("id")
  const limit = request.nextUrl.searchParams.get("limit") || "100"
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    const res  = await fetch(`${BASE}/playlist/${encodeURIComponent(id)}?limit=${limit}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: "Playlist unavailable" }, { status: 500 })
  }
}
