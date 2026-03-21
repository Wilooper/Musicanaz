import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params
  const sp       = request.nextUrl.searchParams
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  try {
    const cleanId = videoId.toUpperCase().startsWith("VL") ? videoId.slice(2) : videoId
    const res = await fetch(`${BASE}/playlist/${encodeURIComponent(cleanId)}?limit=100&country=${country}&language=${language}`)
    if (res.ok) return NextResponse.json(await res.json())
    const res2 = await fetch(`${BASE}/playlist/${encodeURIComponent(videoId)}?limit=100&country=${country}&language=${language}`)
    if (res2.ok) return NextResponse.json(await res2.json())
    const songRes = await fetch(`${BASE}/song/${encodeURIComponent(videoId)}?country=${country}&language=${language}`)
    return NextResponse.json(await songRes.json())
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 500 })
  }
}
