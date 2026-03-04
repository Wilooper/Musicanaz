import { type NextRequest, NextResponse } from "next/server"

const BASE = "https://turbo-14uz.onrender.com"

// Country metadata for display
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

async function fetchCountryTrending(country: string, limit: number) {
  try {
    const res = await fetch(
      `${BASE}/trending?country=${country}&limit=${limit}`,
      { next: { revalidate: 600 } }
    )
    if (!res.ok) return []
    const json = await res.json()
    // mpyapi /trending returns { country, trending: [...], count }
    const tracks = json?.trending || []
    return tracks.map((t: any) => ({
      ...t,
      // Ensure consistent fields for the frontend
      videoId:   t.videoId   || "",
      title:     t.title     || "Unknown",
      artist:    Array.isArray(t.artists)
        ? t.artists.map((a: any) => (typeof a === "string" ? a : a?.name)).filter(Boolean).join(", ")
        : (t.artist || "Unknown"),
      thumbnail: t.thumbnail || t.thumbnails?.[0]?.url || "",
      duration:  t.duration  || "",
      _country:  country,
    }))
  } catch {
    return []
  }
}

async function fetchCountryCharts(country: string, limit: number) {
  try {
    const res = await fetch(
      `${BASE}/charts?country=${country}`,
      { next: { revalidate: 600 } }
    )
    if (!res.ok) return []
    const json = await res.json()
    // mpyapi /charts returns { songs:[], trending:[], videos:[], artists:[] }
    // Use trending first, fall back to songs
    const tracks = json?.trending || json?.songs || []
    return tracks.slice(0, limit).map((t: any) => ({
      ...t,
      videoId:   t.videoId   || "",
      title:     t.title     || "Unknown",
      artist:    Array.isArray(t.artists)
        ? t.artists.map((a: any) => (typeof a === "string" ? a : a?.name)).filter(Boolean).join(", ")
        : (t.artist || "Unknown"),
      thumbnail: t.thumbnail || t.thumbnails?.[0]?.url || "",
      duration:  t.duration  || "",
      _country:  country,
    }))
  } catch {
    return []
  }
}

export async function GET(request: NextRequest) {
  const sp      = request.nextUrl.searchParams
  const country = sp.get("country") || ""
  const limit   = Number(sp.get("limit") || "20")
  const multi   = sp.get("multi") === "1"

  try {
    if (multi || !country || country === "ZZ") {
      // Global mix: fetch from multiple countries
      const countries = ["US", "GB", "IN"]
      const perCountry = Math.ceil(limit / countries.length) || 7

      // Try /trending first, fall back to /charts for each country
      const results = await Promise.allSettled(
        countries.map(async (c) => {
          const trending = await fetchCountryTrending(c, perCountry)
          if (trending.length > 0) return trending
          // Fallback to charts if trending is empty
          return fetchCountryCharts(c, perCountry)
        })
      )

      // Interleave: 1 from each country in rotation for variety
      const lists = results.map(r => (r.status === "fulfilled" ? r.value : []))
      const maxLen = Math.max(...lists.map(l => l.length), 0)
      const merged: any[] = []
      for (let i = 0; i < maxLen; i++) {
        for (const list of lists) {
          if (list[i]) merged.push(list[i])
        }
      }

      // Deduplicate by videoId, then by title+artist
      const seen = new Set<string>()
      const deduped = merged.filter(t => {
        const key = t.videoId
          ? `vid:${t.videoId}`
          : `${t.title}||${t.artist}`.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      return NextResponse.json({
        trending: deduped.slice(0, limit),
        count:    deduped.length,
        source:   "global",
      })
    }

    // Single country — try /trending, fall back to /charts
    let tracks = await fetchCountryTrending(country, limit)
    if (tracks.length === 0) {
      tracks = await fetchCountryCharts(country, limit)
    }

    return NextResponse.json({
      trending: tracks.slice(0, limit),
      count:    tracks.length,
      source:   country,
    })
  } catch {
    return NextResponse.json({ trending: [], count: 0, source: "error" })
  }
}
