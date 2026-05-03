"use client"
/**
 * components/yt-home-section.tsx
 * Renders personalised YouTube sections (home/explore/trending) on the main page.
 *
 * Usage:
 *   import { YTHomeSection } from "@/components/yt-home-section"
 *   <YTHomeSection />
 */

import { useEffect, useState } from "react"
import { cookiesAreSet, getYTHome, getYTTrending, ytItemToSong, type YTSection } from "@/lib/yt-client"

interface Props {
  onPlay: (song: ReturnType<typeof ytItemToSong>) => void
}

export function YTHomeSection({ onPlay }: Props) {
  const [sections, setSections]   = useState<YTSection[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")
  const [hasCookies, setHasCookies] = useState(false)

  useEffect(() => {
    setHasCookies(cookiesAreSet())
  }, [])

  useEffect(() => {
    if (!hasCookies) return
    setLoading(true)
    setError("")
    Promise.allSettled([getYTHome(), getYTTrending()])
      .then(results => {
        const merged: YTSection[] = []
        for (const r of results) {
          if (r.status === "fulfilled") {
            merged.push(...(r.value.sections ?? []))
          }
        }
        // Deduplicate sections by title
        const seen = new Set<string>()
        const deduped = merged.filter(s => {
          if (!s.title || seen.has(s.title)) return false
          seen.add(s.title); return true
        })
        setSections(deduped.filter(s => s.items?.length > 0))
      })
      .catch(e => setError(e?.message ?? "Failed to load"))
      .finally(() => setLoading(false))
  }, [hasCookies])

  if (!hasCookies) return null

  return (
    <div className="space-y-6 mt-6">
      {loading && (
        <div className="text-sm text-white/30 animate-pulse px-1">Loading your YouTube…</div>
      )}

      {error && (
        <div className="text-xs text-red-400/70 px-1">{error}</div>
      )}

      {sections.map(section => (
        <div key={section.title} className="space-y-3">
          <h2 className="text-sm font-semibold text-white/80 px-1">{section.title}</h2>
          <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
            {section.items.slice(0, 20).map(item => {
              const song = ytItemToSong(item)
              return (
                <button
                  key={item.videoId}
                  onClick={() => onPlay(song)}
                  className="shrink-0 w-36 text-left group"
                >
                  <div className="w-36 h-36 rounded-xl overflow-hidden bg-white/5 mb-2 relative">
                    {item.thumbnail ? (
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">🎵</div>
                    )}
                    {/* Play overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-200 flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <svg className="w-8 h-8 text-white drop-shadow" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z"/>
                        </svg>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs font-medium text-white/90 truncate leading-tight">{item.title}</p>
                  {item.artist && (
                    <p className="text-[11px] text-white/40 truncate mt-0.5">{item.artist}</p>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
