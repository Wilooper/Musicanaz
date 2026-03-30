import { type NextRequest, NextResponse } from "next/server"
const AI = process.env.AI_API_URL || ""
export async function POST(req: NextRequest) {
  if (!AI) return NextResponse.json({ error: "AI_API_URL not set" }, { status: 503 })
  try {
    const body = await req.json()
    const res  = await fetch(`${AI}/analyze`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(90_000),
    })
    return NextResponse.json(await res.json())
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
