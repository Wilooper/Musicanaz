import { type NextRequest, NextResponse } from "next/server"
import { submitTopSongs, submitTopArtists } from "@/lib/toplay-client"
import type { TopSongSubmission, TopArtistSubmission } from "@/lib/toplay-types"

interface SubmitBody {
  uid: string
  topSongs?: TopSongSubmission[]
  topArtists?: TopArtistSubmission[]
}

export async function POST(request: NextRequest) {
  let body: SubmitBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { uid, topSongs, topArtists } = body
  if (!uid) {
    return NextResponse.json({ error: "uid is required" }, { status: 400 })
  }

  try {
    const tasks: Promise<void>[] = []
    if (topSongs?.length) tasks.push(submitTopSongs(uid, topSongs))
    if (topArtists?.length) tasks.push(submitTopArtists(uid, topArtists))
    await Promise.all(tasks)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to submit data to toplay", detail: String(err) },
      { status: 502 }
    )
  }
}
