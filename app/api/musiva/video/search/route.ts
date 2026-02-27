import { type NextRequest, NextResponse } from "next/server"

const BASE_URL = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const q = searchParams.get("q")
    const limit = searchParams.get("limit") || "20"

    if (!q) {
      return NextResponse.json({ error: "Missing 'q' parameter" }, { status: 400 })
    }

    const url = `${BASE_URL}/search?query=${encodeURIComponent(q)}&filter=videos&limit=${limit}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Video search error:", error)
    return NextResponse.json({ error: "Video search failed", videos: [] }, { status: 500 })
  }
}
