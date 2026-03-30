import { type NextRequest, NextResponse } from "next/server"
const AI = process.env.AI_API_URL || ""
export async function GET(req: NextRequest) {
  if (!AI) return NextResponse.json({ similar_users: [] })
  const uid = req.nextUrl.searchParams.get("user_id") || "anon"
  try {
    const res = await fetch(`${AI}/user/${encodeURIComponent(uid)}/similar-users`,
      { signal: AbortSignal.timeout(10_000) })
    return NextResponse.json(await res.json())
  } catch (e: any) { return NextResponse.json({ similar_users: [], error: e.message }, { status: 500 }) }
}
