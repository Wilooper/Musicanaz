import { NextRequest, NextResponse } from "next/server"

const YTDATA_URL = process.env.YTDATA_URL ?? ""

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const endpoint = "/" + path.join("/")

  if (!YTDATA_URL) {
    return NextResponse.json({ error: "YTDATA_URL not configured" }, { status: 503 })
  }

  try {
    const body = await req.text()
    const upstream = await fetch(`${YTDATA_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15_000),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upstream error" }, { status: 502 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const endpoint = "/" + path.join("/")

  if (!YTDATA_URL) {
    return NextResponse.json({ error: "YTDATA_URL not configured" }, { status: 503 })
  }

  try {
    const upstream = await fetch(`${YTDATA_URL}${endpoint}`, {
      signal: AbortSignal.timeout(15_000),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upstream error" }, { status: 502 })
  }
}
