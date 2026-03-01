import type { Metadata } from "next"

export const metadata: Metadata = {
  title:       "Listening History & Stats",
  description: "See your complete listening history, top played songs of the day, week, and month, plus detailed listening stats and activity heatmap.",
  alternates:  { canonical: "https://musicanaz.vercel.app/history" },
  robots:      { index: false },   // personal data — don't index
  openGraph: {
    title:       "Your Listening History | Musicanaz",
    description: "Top songs, listening stats, and your full play history.",
    url:         "https://musicanaz.vercel.app/history",
  },
}

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
