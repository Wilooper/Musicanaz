import type { Metadata } from "next"

export const metadata: Metadata = {
  title:       "About Musicanaz — Free Music PWA",
  description: "Musicanaz is a free music streaming Progressive Web App (PWA) with synced lyrics, trending charts, radio stations, party mode, and more — powered by YouTube Music.",
  alternates:  { canonical: "https://musicanaz.vercel.app/about" },
  openGraph: {
    title:       "About Musicanaz",
    description: "Free music streaming PWA with synced lyrics and trending charts.",
    url:         "https://musicanaz.vercel.app/about",
  },
}

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
