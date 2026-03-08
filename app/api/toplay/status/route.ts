import { NextResponse } from "next/server"
import { fetchApiStatus } from "@/lib/toplay-client"

export async function GET() {
  const data = await fetchApiStatus()
  if (!data) {
    return NextResponse.json(
      { error: "Failed to fetch toplay API status" },
      { status: 502 }
    )
  }
  return NextResponse.json(data)
}
