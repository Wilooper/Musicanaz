import { type NextRequest, NextResponse } from "next/server"

interface CollabSong {
  id: string; title: string; artist: string
  thumbnail: string; videoId: string; duration: string
  addedBy: string; addedAt: number
}

interface CollabPlaylist {
  id:        string
  name:      string
  ownerId:   string
  songs:     CollabSong[]
  createdAt: number
  updatedAt: number
  // Notification log — last 20 events collaborators can read
  events:    CollabEvent[]
}

interface CollabEvent {
  type:      "addSong" | "removeSong" | "rename" | "create"
  songTitle?: string
  by:        string
  at:        number
}

// In-memory store (resets on cold start — fine for collab sessions)
const store = new Map<string, CollabPlaylist>()

function genId() {
  return Math.random().toString(36).slice(2, 9).toUpperCase()
}

function addEvent(pl: CollabPlaylist, event: CollabEvent) {
  if (!pl.events) pl.events = []
  pl.events = [event, ...pl.events].slice(0, 20)
}

// Auto-cleanup playlists older than 7 days
function cleanup() {
  const cutoff = Date.now() - 7 * 86_400_000
  for (const [id, pl] of store.entries()) {
    if (pl.createdAt < cutoff) store.delete(id)
  }
}

export async function GET(req: NextRequest) {
  cleanup()
  const id    = req.nextUrl.searchParams.get("id")
  const since = parseInt(req.nextUrl.searchParams.get("since") || "0")

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })
  const pl = store.get(id)
  if (!pl) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // If caller passes ?since=timestamp, only return events newer than that
  const newEvents = since > 0 ? (pl.events || []).filter(e => e.at > since) : (pl.events || [])
  return NextResponse.json({ ...pl, events: newEvents })
}

export async function POST(req: NextRequest) {
  cleanup()
  const body = await req.json().catch(() => ({}))
  const { action, id, name, ownerId, song, songId, userId, username } = body

  if (action === "create") {
    const newId = genId()
    const pl: CollabPlaylist = {
      id: newId, name: name || "Collab Playlist",
      ownerId: ownerId || "anon",
      songs: [], events: [],
      createdAt: Date.now(), updatedAt: Date.now(),
    }
    addEvent(pl, { type: "create", by: username || userId || "anon", at: Date.now() })
    store.set(newId, pl)
    return NextResponse.json({ id: newId, playlist: pl })
  }

  const pl = store.get(id)
  if (!pl) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (action === "addSong") {
    if (!song) return NextResponse.json({ error: "Missing song" }, { status: 400 })
    if (pl.songs.length >= 100) return NextResponse.json({ error: "Playlist full (100 songs max)" }, { status: 400 })
    if (pl.songs.some(s => s.id === song.id)) return NextResponse.json({ error: "Already added" }, { status: 409 })
    pl.songs.push({ ...song, addedBy: username || userId || "anon", addedAt: Date.now() })
    pl.updatedAt = Date.now()
    addEvent(pl, { type: "addSong", songTitle: song.title, by: username || userId || "anon", at: Date.now() })
    return NextResponse.json({ ok: true, playlist: pl })
  }

  if (action === "removeSong") {
    const removed = pl.songs.find(s => s.id === songId)
    pl.songs = pl.songs.filter(s => s.id !== songId)
    pl.updatedAt = Date.now()
    if (removed) addEvent(pl, { type: "removeSong", songTitle: removed.title, by: username || userId || "anon", at: Date.now() })
    return NextResponse.json({ ok: true, playlist: pl })
  }

  if (action === "rename") {
    if (pl.ownerId !== userId) return NextResponse.json({ error: "Not owner" }, { status: 403 })
    pl.name = name || pl.name
    pl.updatedAt = Date.now()
    addEvent(pl, { type: "rename", by: username || userId || "anon", at: Date.now() })
    return NextResponse.json({ ok: true, playlist: pl })
  }

  if (action === "deletePlaylist") {
    if (pl.ownerId !== userId) return NextResponse.json({ error: "Not owner" }, { status: 403 })
    store.delete(id)
    return NextResponse.json({ ok: true, deleted: true })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
