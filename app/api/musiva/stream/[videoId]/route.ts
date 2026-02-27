import { type NextRequest, NextResponse } from "next/server"

const BASE_URL = "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  try {
    const { videoId } = await params

    const url = `${BASE_URL}/stream/${videoId}`
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`API returned ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Stream error:", error)
    return NextResponse.json({ error: "Stream unavailable" }, { status: 503 })
  }
}
