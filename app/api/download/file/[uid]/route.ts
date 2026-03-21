export const runtime = "edge"
import type { NextRequest } from "next/server"

const DL_BASE = (
  process.env.DOWNLOAD_SERVER_URL ||
  process.env.MUSIVA_API_URL      ||
  "https://turbo-14uz.onrender.com"
).replace(/\/+$/, "")

export async function GET(request: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid }  = await params
  const filename = request.nextUrl.searchParams.get("filename") || "song.mp3"
  try {
    const upstream = await fetch(`${DL_BASE}/download/file/${encodeURIComponent(uid)}`)
    if (!upstream.ok)
      return new Response(JSON.stringify({ error: `Upstream ${upstream.status}` }), { status: upstream.status })
    const ct = upstream.headers.get("Content-Type") || "audio/mpeg"
    const cl = upstream.headers.get("Content-Length") || ""
    const headers = new Headers({
      "Content-Type":           ct,
      "Content-Disposition":    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control":          "no-store",
      "X-Content-Type-Options": "nosniff",
    })
    if (cl) headers.set("Content-Length", cl)
    return new Response(upstream.body, { status: 200, headers })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message }), { status: 502 })
  }
}
