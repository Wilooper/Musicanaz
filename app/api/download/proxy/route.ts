// Edge runtime — true streaming proxy, no Vercel timeout
export const runtime = "edge"

import type { NextRequest } from "next/server"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const rawUrl   = sp.get("url")
  const filename = sp.get("filename") || "audio.webm"
  const mime     = sp.get("mime")     || "audio/webm"

  if (!rawUrl) {
    return new Response(JSON.stringify({ error: "Missing url" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  let audioUrl: string
  try { audioUrl = decodeURIComponent(rawUrl) } catch { audioUrl = rawUrl }

  try {
    const upstream = await fetch(audioUrl, {
      headers: {
        "User-Agent":      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
        "Referer":         "https://www.youtube.com/",
        "Origin":          "https://www.youtube.com",
        "Accept-Encoding": "identity",
      },
    })

    if (!upstream.ok) {
      return new Response(
        JSON.stringify({ error: `Upstream returned ${upstream.status}` }),
        { status: upstream.status }
      )
    }

    const ct = upstream.headers.get("Content-Type") || mime
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
    return new Response(
      JSON.stringify({ error: err?.message || "Proxy failed" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    )
  }
}
