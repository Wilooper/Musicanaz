import { type NextRequest, NextResponse } from "next/server"

const BASE_URL = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const videoId = searchParams.get("video_id")

    if (!videoId) {
      return NextResponse.json({ error: "Missing 'video_id' parameter" }, { status: 400 })
    }

    const url = `${BASE_URL}/song/${videoId}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Song metadata error:", error)
    return NextResponse.json({ error: "Song metadata unavailable" }, { status: 500 })
  }
}
