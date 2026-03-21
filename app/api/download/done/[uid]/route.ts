import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const DL_BASE = (
  process.env.DOWNLOAD_SERVER_URL ||
  process.env.MUSIVA_API_URL      ||
  "https://turbo-14uz.onrender.com"
).replace(/\/+$/, "")

export async function POST(_req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  const { uid } = await params
  try {
    await fetch(`${DL_BASE}/download/done/${encodeURIComponent(uid)}`, { method: "POST" })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false })
  }
}
