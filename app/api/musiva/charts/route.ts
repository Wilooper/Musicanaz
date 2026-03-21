import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  const sources  = sp.get("sources")  || "all"
  try {
    const res = await fetch(
      `${BASE}/charts?country=${country}&language=${language}&sources=${sources}`,
      { next: { revalidate: 600 } }
    )
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()

    // data.ytm_songs has videoId (playable), data.songs is Apple Music (no videoId)
    // Prefer YTM songs for the songs tab; Apple Music is used only when YTM has nothing
    const songs = (data.ytm_songs?.length ? data.ytm_songs : null)
               || (data.songs?.length     ? data.songs     : null)
               || (data.apple_music_top?.length ? data.apple_music_top : [])

    // Trending: YTM trending first, then merged YTM songs
    const trending = data.trending?.length ? data.trending
                   : data.ytm_songs?.length ? data.ytm_songs
                   : []

    // Artists: combine YTM artists + Deezer artists, deduplicate by name
    const ytmArtists    = Array.isArray(data.artists)       ? data.artists       : []
    const deezerArtists = Array.isArray(data.deezer_artists) ? data.deezer_artists : []
    const seenNames     = new Set<string>()
    const artists       = [...ytmArtists, ...deezerArtists].filter(a => {
      const n = (a?.name || a?.title || "").toLowerCase()
      if (!n || seenNames.has(n)) return false
      seenNames.add(n); return true
    })

    return NextResponse.json({
      songs,
      videos:          data.videos          || [],
      artists,
      trending,
      // Extra fields the UI can use if needed
      apple_music_top: data.apple_music_top || [],
      deezer_top:      data.deezer_top      || [],
      lastfm_top:      data.lastfm_top      || [],
      sources_used:    data.sources_used    || {},
    })
  } catch {
    return NextResponse.json({ songs: [], videos: [], artists: [], trending: [] })
  }
}
