import { NextResponse } from "next/server"

const DEEZER_CHART = "https://api.deezer.com/chart"

function mapDeezerTrack(t: any) {
  return {
    videoId:       "",
    title:         t.title  || t.title_short || "Unknown",
    artist:        t.artist?.name || "Unknown",
    thumbnail:     t.album?.cover_big || t.album?.cover_medium || t.album?.cover || "",
    duration:      t.duration ? `${Math.floor(t.duration / 60)}:${String(t.duration % 60).padStart(2, "0")}` : "",
    album:         t.album?.title || "",
    _deezerTitle:  t.title  || t.title_short || "",
    _deezerArtist: t.artist?.name || "",
    _deezer:       true,
  }
}

function mapDeezerArtist(a: any) {
  return {
    name:           a.name || "Unknown",
    thumbnail:      a.picture_big || a.picture_medium || a.picture || "",
    browseId:       null,
    _deezerArtist:  true,
  }
}

export async function GET() {
  try {
    const res = await fetch(DEEZER_CHART, { next: { revalidate: 600 } })
    if (!res.ok) throw new Error(`Deezer returned ${res.status}`)
    const data = await res.json()

    const songs    = (data.tracks?.data  || []).map(mapDeezerTrack)
    const artists  = (data.artists?.data || []).map(mapDeezerArtist)

    return NextResponse.json({
      songs,
      videos:   [],
      artists,
      trending: songs,
    })
  } catch {
    return NextResponse.json({ songs: [], videos: [], artists: [], trending: [] })
  }
}
