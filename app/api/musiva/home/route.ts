import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const limit    = sp.get("limit")    || "6"
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  try {
    const res = await fetch(`${BASE}/home?limit=${limit}&country=${country}&language=${language}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json(Array.isArray(data) ? data : [])
  } catch {
    return NextResponse.json([])
  }
}
