import { type NextRequest, NextResponse } from "next/server"
const BASE = process.env.MUSIVA_API_URL || "https://turbo-14uz.onrender.com"

export const TRENDING_COUNTRIES: Record<string, { flag: string; name: string }> = {
  US: { flag: "🇺🇸", name: "United States" }, GB: { flag: "🇬🇧", name: "United Kingdom" },
  IN: { flag: "🇮🇳", name: "India" },         AU: { flag: "🇦🇺", name: "Australia" },
  CA: { flag: "🇨🇦", name: "Canada" },         JP: { flag: "🇯🇵", name: "Japan" },
  KR: { flag: "🇰🇷", name: "South Korea" },    BR: { flag: "🇧🇷", name: "Brazil" },
  DE: { flag: "🇩🇪", name: "Germany" },         FR: { flag: "🇫🇷", name: "France" },
  MX: { flag: "🇲🇽", name: "Mexico" },         NG: { flag: "🇳🇬", name: "Nigeria" },
  ZA: { flag: "🇿🇦", name: "South Africa" },   PK: { flag: "🇵🇰", name: "Pakistan" },
  ID: { flag: "🇮🇩", name: "Indonesia" },
}

export async function GET(request: NextRequest) {
  const sp       = request.nextUrl.searchParams
  const country  = sp.get("country")  || "ZZ"
  const language = sp.get("language") || "en"
  const limit    = Math.min(Number(sp.get("limit") || "25"), 100)
  const sources  = sp.get("sources") || "all"
  try {
    const res = await fetch(
      `${BASE}/trending?country=${country}&language=${language}&limit=${limit}&sources=${sources}`,
      { next: { revalidate: 600 } }
    )
    if (!res.ok) throw new Error(`${res.status}`)
    const data = await res.json()

    // Backend returns { trending: [ytm_only], merged: [all_deduped], apple_top, deezer_top, lastfm_top }
    // data.merged is already deduplicated across all 4 sources — use it as primary
    // Fall back chain: merged → apple_top → ytm trending → deezer_top
    const raw: any[] = (
      data.merged?.length      ? data.merged      :
      data.apple_top?.length   ? data.apple_top   :
      data.trending?.length    ? data.trending    :
      data.deezer_top?.length  ? data.deezer_top  :
      data.lastfm_top?.length  ? data.lastfm_top  :
      Array.isArray(data)      ? data             : []
    )

    const trending = raw.slice(0, limit).map((t: any) => ({
      videoId:   t.videoId   || "",
      title:     t.title     || "Unknown",
      artist:    Array.isArray(t.artists)
        ? t.artists.map((a: any) => typeof a === "string" ? a : a?.name).filter(Boolean).join(", ")
        : (t.artist || "Unknown"),
      thumbnail: t.thumbnail || t.thumbnails?.[0]?.url || "",
      duration:  t.duration  || "",
      album:     t.album     || "",
      source:    t.source    || "",
    }))

    return NextResponse.json({ trending, count: trending.length, source: "musiva" })
  } catch {
    return NextResponse.json({ trending: [], count: 0, source: "error" })
  }
}
