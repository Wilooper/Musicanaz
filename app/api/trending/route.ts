import { NextResponse } from "next/server"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const language = searchParams.get("language") || "Hindi"
  const limit = searchParams.get("limit") || "10"

  try {
    const response = await fetch(`https://gaanapy-0h31.onrender.com/trending?language=${language}&limit=${limit}`, {
      headers: {
        accept: "application/json",
      },
    })

    if (!response.ok) {
      throw new Error(`API responded with status: ${response.status}`)
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error("Trending API error:", error)
    return NextResponse.json({ error: "Failed to fetch trending songs" }, { status: 500 })
  }
}
