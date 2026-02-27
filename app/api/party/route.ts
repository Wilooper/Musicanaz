import { NextRequest, NextResponse } from "next/server"

// ─── In-memory party store (resets on cold start — fine for demo) ──
interface ChatMessage { id: string; user: string; text: string; ts: number }
interface Vote        { songId: string; voters: string[] }
interface PartyState {
  hostId:    string
  queue:     any[]
  chat:      ChatMessage[]
  votes:     Vote[]
  reactions: { user: string; emoji: string; ts: number }[]
  createdAt: number
}

const parties: Map<string, PartyState> = new Map()

// Clean up parties older than 3 hours
function cleanup() {
  const threshold = Date.now() - 3 * 60 * 60 * 1000
  for (const [id, p] of parties.entries()) {
    if (p.createdAt < threshold) parties.delete(id)
  }
}

// ─── GET /api/party?id=xxx  — get party state
// ─── POST /api/party — create party or send action
export async function GET(req: NextRequest) {
  cleanup()
  const id = req.nextUrl.searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  const party = parties.get(id)
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 })
  return NextResponse.json(party)
}

export async function POST(req: NextRequest) {
  cleanup()
  const body = await req.json().catch(() => ({}))
  const { action, partyId, guestId, song, text, emoji, songId } = body

  // ── Create party ──
  if (action === "create") {
    const id = Math.random().toString(36).slice(2, 9).toUpperCase()
    parties.set(id, {
      hostId:    guestId || "host",
      queue:     [],
      chat:      [],
      votes:     [],
      reactions: [],
      createdAt: Date.now(),
    })
    return NextResponse.json({ partyId: id })
  }

  const party = parties.get(partyId)
  if (!party) return NextResponse.json({ error: "Party not found" }, { status: 404 })

  // ── Add song to queue ──
  if (action === "addSong" && song) {
    if (!party.queue.find((s: any) => s.id === song.id)) {
      party.queue.push({ ...song, addedBy: guestId })
    }
    return NextResponse.json({ ok: true, queue: party.queue })
  }

  // ── Vote for song ──
  if (action === "vote" && songId) {
    let vote = party.votes.find(v => v.songId === songId)
    if (!vote) { vote = { songId, voters: [] }; party.votes.push(vote) }
    if (!vote.voters.includes(guestId)) vote.voters.push(guestId)
    return NextResponse.json({ ok: true, votes: party.votes })
  }

  // ── Send chat message ──
  if (action === "chat" && text) {
    const msg: ChatMessage = {
      id:   Math.random().toString(36).slice(2, 9),
      user: body.username || guestId || "Guest",
      text: String(text).slice(0, 200),
      ts:   Date.now(),
    }
    party.chat.push(msg)
    if (party.chat.length > 100) party.chat = party.chat.slice(-100)
    return NextResponse.json({ ok: true, chat: party.chat })
  }

  // ── Send reaction ──
  if (action === "react" && emoji) {
    party.reactions.push({ user: guestId, emoji, ts: Date.now() })
    if (party.reactions.length > 50) party.reactions = party.reactions.slice(-50)
    return NextResponse.json({ ok: true })
  }

  // ── Host: mark song as played (shift queue) ──
  if (action === "popQueue") {
    party.queue.shift()
    return NextResponse.json({ ok: true, queue: party.queue })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
