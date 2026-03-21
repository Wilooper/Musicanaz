import { type NextRequest, NextResponse } from "next/server"

// Proxy to MUSIVA download API.
// If DOWNLOAD_SERVER_URL is set it takes priority, otherwise uses MUSIVA_API_URL.
// This route is only called when the user has NOT configured a personal server
// (when they have one, handleDownload calls it directly from the client).
const DL_BASE = (
  process.env.DOWNLOAD_SERVER_URL ||
  process.env.MUSIVA_API_URL      ||
  "https://turbo-14uz.onrender.com"
).replace(/\/+$/, "")

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { video_id } = body
    if (!video_id) return NextResponse.json({ error: "Missing video_id" }, { status: 400 })
    const res = await fetch(`${DL_BASE}/download/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ video_id }),
      signal: AbortSignal.timeout(15_000),
    })
    if (!res.ok) throw new Error(`Download server returned ${res.status}`)
    return NextResponse.json(await res.json())
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to start download" }, { status: 502 })
  }
}
