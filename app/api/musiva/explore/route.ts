import { NextResponse } from "next/server"
const BASE = "https://turbo-14uz.onrender.com"

export async function GET() {
  try {
    const res = await fetch(`${BASE}/explore`, { next: { revalidate: 600 } })
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()
    return NextResponse.json(data)
  } catch (e) {
    return NextResponse.json({ error: "Explore unavailable" }, { status: 500 })
  }
}
