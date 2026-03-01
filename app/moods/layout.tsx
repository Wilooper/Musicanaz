import type { Metadata } from "next"

export const metadata: Metadata = {
  title:       "Moods & Genres — Discover Music by Vibe",
  description: "Browse music by mood and genre. From chill lo-fi to hype hip-hop, party anthems to focus beats — find the perfect playlist for every moment.",
  alternates:  { canonical: "https://musicanaz.vercel.app/moods" },
  openGraph: {
    title:       "Moods & Genres | Musicanaz",
    description: "Browse music by mood and genre. Find the perfect playlist for every moment.",
    url:         "https://musicanaz.vercel.app/moods",
  },
}

export default function MoodsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
