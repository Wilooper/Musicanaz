/**
 * app/api/ytdata/[...path]/route.ts
 * Transparent proxy to the ytdata-go service.
 * Strips CORS issues on mobile browsers.
 */

import { NextRequest, NextResponse } from "next/server"

const YTDATA_URL = process.env.YTDATA_URL ?? process.env.NEXT_PUBLIC_YTDATA_URL ?? ""

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  if (!YTDATA_URL) {
    return NextResponse.json({ error: "YTDATA_URL not configured" }, { status: 503 })
  }

  const path    = "/" + (params.path ?? []).join("/")
  const allowed = ["/home", "/explore", "/trending", "/history", "/liked", "/related", "/record_play"]
  if (!allowed.includes(path)) {
    return NextResponse.json({ error: "unknown path" }, { status: 404 })
  }

  const body = await req.text()

  try {
    const upstream = await fetch(YTDATA_URL + path, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(18_000),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "upstream error" }, { status: 502 })
  }
}
