import { type NextRequest, NextResponse } from "next/server"

const DEEZER_CHART = "https://api.deezer.com/chart/0/tracks"

// Country metadata for display (kept for frontend pill compatibility)
export const TRENDING_COUNTRIES: Record<string, { flag: string; name: string }> = {
  US: { flag: "🇺🇸", name: "United States" },
  GB: { flag: "🇬🇧", name: "United Kingdom" },
  IN: { flag: "🇮🇳", name: "India" },
  AU: { flag: "🇦🇺", name: "Australia" },
  CA: { flag: "🇨🇦", name: "Canada" },
  JP: { flag: "🇯🇵", name: "Japan" },
  KR: { flag: "🇰🇷", name: "South Korea" },
  BR: { flag: "🇧🇷", name: "Brazil" },
  DE: { flag: "🇩🇪", name: "Germany" },
  FR: { flag: "🇫🇷", name: "France" },
  MX: { flag: "🇲🇽", name: "Mexico" },
  NG: { flag: "🇳🇬", name: "Nigeria" },
  ZA: { flag: "🇿🇦", name: "South Africa" },
  PK: { flag: "🇵🇰", name: "Pakistan" },
  ID: { flag: "🇮🇩", name: "Indonesia" },
}

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

export async function GET(request: NextRequest) {
  const sp    = request.nextUrl.searchParams
  const limit = Math.min(Number(sp.get("limit") || "20"), 50)

  try {
    const res = await fetch(`${DEEZER_CHART}?limit=${limit}`, {
      next: { revalidate: 600 },
    })
    if (!res.ok) throw new Error(`Deezer returned ${res.status}`)
    const data = await res.json()

    const tracks = (data.data || []).slice(0, limit).map(mapDeezerTrack)

    return NextResponse.json({
      trending: tracks,
      count:    tracks.length,
      source:   "deezer",
    })
  } catch {
    return NextResponse.json({ trending: [], count: 0, source: "error" })
  }
}
