import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params
  const sp       = request.nextUrl.searchParams
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  try {
    const res = await fetch(`${BASE}/stream/${encodeURIComponent(videoId)}?country=${country}&language=${language}`)
    if (!res.ok) throw new Error(`${res.status}`)
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: "Stream unavailable" }, { status: 503 })
  }
}
