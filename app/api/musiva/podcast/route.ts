import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const id    = request.nextUrl.searchParams.get("id")
  const limit = request.nextUrl.searchParams.get("limit") || "50"
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  try {
    // v4 backend handles all ID formats: VLMPSPPLxxx, MPSPPLxxx, bare IDs
    const res  = await fetch(`${BASE}/podcast/${encodeURIComponent(id)}?limit=${limit}`)
    if (res.ok) {
      const data = await res.json()
      // Backend already normalizes episodes shape: { title, author, thumbnail, episodes, total }
      return NextResponse.json(data)
    }
    if (res.status === 404) {
      return NextResponse.json({ error: "Podcast not found" }, { status: 404 })
    }
    throw new Error(`${res.status}`)
  } catch (e: any) {
    if (e?.message === "404") return NextResponse.json({ error: "Podcast not found" }, { status: 404 })
    return NextResponse.json({ error: "Podcast unavailable" }, { status: 500 })
  }
}
