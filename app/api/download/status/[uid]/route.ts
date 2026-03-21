import { type NextRequest, NextResponse } from "next/server"

const DL_BASE = (
  process.env.DOWNLOAD_SERVER_URL ||
  process.env.MUSIVA_API_URL      ||
  "https://turbo-14uz.onrender.com"
).replace(/\/+$/, "")

export async function GET(_req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  try {
    const res = await fetch(`${DL_BASE}/download/status/${encodeURIComponent(uid)}`, {
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) throw new Error(`${res.status}`)
    return NextResponse.json(await res.json())
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Status check failed" }, { status: 502 })
  }
}
