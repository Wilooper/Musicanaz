import { type NextRequest, NextResponse } from "next/server"
import { fetchTrendingSongs } from "@/lib/toplay-client"

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : undefined
  const page  = searchParams.get("page")  ? Number(searchParams.get("page"))  : undefined
  const genre = searchParams.get("genre") || undefined

  const data = await fetchTrendingSongs({ limit, page, genre })
  if (!data) {
    return NextResponse.json(
      { error: "Failed to fetch trending songs from toplay" },
      { status: 502 }
    )
  }
  return NextResponse.json(data)
}
