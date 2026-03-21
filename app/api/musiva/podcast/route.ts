import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const id       = sp.get("id")
  const limit    = sp.get("limit")    || "50"
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  try {
    const res = await fetch(`${BASE}/podcast/${encodeURIComponent(id)}?limit=${limit}&country=${country}&language=${language}`)
    if (res.ok) return NextResponse.json(await res.json())
    if (res.status === 404) return NextResponse.json({ error: "Podcast not found" }, { status: 404 })
    throw new Error(`${res.status}`)
  } catch (e: any) {
    if (e?.message === "404") return NextResponse.json({ error: "Podcast not found" }, { status: 404 })
    return NextResponse.json({ error: "Podcast unavailable" }, { status: 500 })
  }
}
