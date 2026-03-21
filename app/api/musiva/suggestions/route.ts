import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const q        = sp.get("q") || sp.get("query") || ""
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  // v8: param renamed from detailed_runs to detailed
  const detailed = sp.get("detailed") || "false"
  if (!q) return NextResponse.json({ suggestions: [] })
  try {
    const res = await fetch(
      `${BASE}/search_suggestions?query=${encodeURIComponent(q)}&country=${country}&language=${language}&detailed=${detailed}`
    )
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    const suggestions = Array.isArray(data)
      ? data.filter((s: any) => typeof s === "string")
      : []
    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ suggestions: [] })
  }
}
