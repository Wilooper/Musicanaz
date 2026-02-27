import { type NextRequest, NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") || request.nextUrl.searchParams.get("query") || ""
  if (!q) return NextResponse.json({ suggestions: [] })
  try {
    const res  = await fetch(`${BASE}/search_suggestions?query=${encodeURIComponent(q)}`)
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    // New backend returns a flat array of strings
    const suggestions = Array.isArray(data) ? data.filter((s: any) => typeof s === "string") : []
    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ suggestions: [] })
  }
}
