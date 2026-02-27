import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const albumId = request.nextUrl.searchParams.get("id")
  if (!albumId) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    const res = await fetch(`${BASE}/album/${encodeURIComponent(albumId)}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Album unavailable" }, { status: 500 })
  }
}
