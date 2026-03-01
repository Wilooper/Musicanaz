import type { Metadata } from "next"

export const metadata: Metadata = {
  title:       "Your Library — Saved Songs & Playlists",
  description: "Access your personal music library. View liked songs, downloaded tracks, and all your custom playlists in one place.",
  alternates:  { canonical: "https://musicanaz.vercel.app/library" },
  openGraph: {
    title:       "Your Library | Musicanaz",
    description: "Your saved songs, playlists, and downloads all in one place.",
    url:         "https://musicanaz.vercel.app/library",
  },
}

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
