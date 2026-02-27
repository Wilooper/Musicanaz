import { type NextRequest, NextResponse } from "next/server"

const TRENDING_BASE = "https://test-0k.onrender.com"

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

async function fetchCountry(country: string, limit: number) {
  const res = await fetch(
    `${TRENDING_BASE}/trending/?country=${country}&limit=${limit}`,
    { next: { revalidate: 600 } }
  )
  if (!res.ok) return []
  const json = await res.json()
  // API returns { status, data: { country, trending: [...] } }
  const tracks = json?.data?.trending || json?.trending || []
  return tracks.map((t: any) => ({
    ...t,
    _country: country, // tag with source country for global mix
  }))
}

export async function GET(request: NextRequest) {
  const sp      = request.nextUrl.searchParams
  const country = sp.get("country") || ""
  const limit   = Number(sp.get("limit") || "20")
  const multi   = sp.get("multi") === "1"

  try {
    if (multi || !country || country === "ZZ") {
      // Global mix: US + GB + IN
      const countries = ["US", "GB", "IN"]
      const perCountry = Math.ceil(limit / countries.length) || 7

      const results = await Promise.allSettled(
        countries.map(c => fetchCountry(c, perCountry))
      )

      // Interleave: 1 from each country in rotation for variety
      const lists = results.map(r => (r.status === "fulfilled" ? r.value : []))
      const maxLen = Math.max(...lists.map(l => l.length))
      const merged: any[] = []
      for (let i = 0; i < maxLen; i++) {
        for (const list of lists) {
          if (list[i]) merged.push(list[i])
        }
      }

      // Deduplicate by song title + artist (no videoId on trending API)
      const seen = new Set<string>()
      const deduped = merged.filter(t => {
        const key = `${t.title}||${t.artist}`.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      return NextResponse.json({
        trending: deduped.slice(0, limit),
        count: deduped.length,
        source: "global",
      })
    }

    // Single country
    const tracks = await fetchCountry(country, limit)
    return NextResponse.json({
      trending: tracks,
      count: tracks.length,
      source: country,
    })
  } catch {
    return NextResponse.json({ trending: [], count: 0, source: "error" })
  }
}
