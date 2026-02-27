import type { Metadata } from "next"

export const metadata: Metadata = {
  title:       "About MUSICANA — Free Music PWA",
  description: "MUSICANA is a free music streaming Progressive Web App (PWA) with synced lyrics, trending charts, radio stations, party mode, and more — powered by YouTube Music.",
  alternates:  { canonical: "https://musicana.vercel.app/about" },
  openGraph: {
    title:       "About MUSICANA",
    description: "Free music streaming PWA with synced lyrics and trending charts.",
    url:         "https://musicana.vercel.app/about",
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
