import { type NextRequest, NextResponse } from "next/server"
const AI = process.env.AI_API_URL || ""
export async function POST(req: NextRequest) {
  if (!AI) return NextResponse.json({ songs: [], personalized: false }, { status: 503 })
  try {
    const body = await req.json()
    const res  = await fetch(`${AI}/recommend`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    })
    return NextResponse.json(await res.json())
  } catch (e: any) { return NextResponse.json({ songs: [], personalized: false, error: e.message }, { status: 500 }) }
}
