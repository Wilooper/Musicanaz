import type { Metadata } from "next"
import { redirect } from "next/navigation"

const BASE = "https://musicanaz.vercel.app"

// ── OG Metadata — makes WhatsApp / Telegram / iMessage show a rich card ──
export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}): Promise<Metadata> {
  const sp       = await searchParams
  const title    = String(sp.title    || "Listen on Musicanaz")
  const artist   = String(sp.artist   || "")
  const videoId  = String(sp.id       || sp.videoId || "")
  const thumb    = String(sp.thumbnail || "")
  const t        = String(sp.t        || "0")
  const e        = String(sp.e        || "0")

  const displayTitle = artist ? `${title} · ${artist}` : title

  // Build the proxy thumbnail so OG image actually loads cross-origin
  const ogImage = thumb
    ? `https://images.weserv.nl/?url=${encodeURIComponent(thumb)}&w=1200&h=630&fit=cover&output=jpg`
    : `${BASE}/og-default.png`

  const desc = [
    artist ? `by ${artist}` : "",
    Number(t) > 0 ? `▶ Starts at ${fmtSec(Number(t))}` : "",
    Number(e) > 0 ? `⏹ Clip ends at ${fmtSec(Number(e))}` : "",
    "Stream free on Musicanaz with live synced lyrics.",
  ].filter(Boolean).join("  •  ")

  const shareUrl = `${BASE}/song?${new URLSearchParams(sp as Record<string, string>).toString()}`

  return {
    title:       displayTitle,
    description: desc,
    openGraph: {
      type:        "music.song",
      title:       displayTitle,
      description: desc,
      url:         shareUrl,
      siteName:    "Musicanaz",
      images: [
        {
          url:    ogImage,
          width:  1200,
          height: 630,
          alt:    displayTitle,
        },
      ],
    },
    twitter: {
      card:        "summary_large_image",
      title:       displayTitle,
      description: desc,
      images:      [ogImage],
    },
    // Tell crawlers this page redirects — don't index it
    robots: { index: false, follow: false },
  }
}

function fmtSec(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, "0")}`
}

// ── Server Component — immediately redirects to player with all params ──
export default async function SongSharePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
  const sp = await searchParams

  // Build player URL preserving all params (id, title, artist, thumbnail, t, e, etc.)
  const playerParams = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (v) playerParams.set(k, String(v))
  }

  // Redirect to player — the player page already reads ?t= (start) and will now read ?e= (stop)
  redirect(`/player?${playerParams.toString()}`)
}
