"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Play, Loader2 } from "lucide-react"
import type { Song } from "@/lib/types"
import { useAudio } from "@/lib/audio-context"
import ImageWithFallback from "./image-with-fallback"
import { addToRecentlyPlayed } from "@/lib/storage"

interface SongCardProps {
  song: Song
  onPlayComplete?: () => void
}

export default function SongCard({ song, onPlayComplete }: SongCardProps) {
  const router = useRouter()
  const { playSong } = useAudio()
  const [resolving, setResolving] = useState(false)

  const handlePlay = async () => {
    if (resolving) return

    let songToPlay = song

    // Reverse-search by title + artist when videoId is missing (e.g. Deezer tracks)
    if (!song.videoId && song.title && song.artist) {
      setResolving(true)
      try {
        const q = `${song.title} ${song.artist}`.trim()
        const data = await fetch(
          `/api/musiva/search?q=${encodeURIComponent(q)}&filter=songs&limit=1`
        ).then(r => r.json())
        const result = data.results?.[0]
        if (result?.videoId) {
          songToPlay = {
            ...song,
            id:        result.videoId,
            videoId:   result.videoId,
            thumbnail: song.thumbnail || result.thumbnail || "",
          }
        }
      } catch {
        // fall through with original song
      } finally {
        setResolving(false)
      }
    }

    if (!songToPlay.videoId) return   // still no videoId — cannot play

    playSong(songToPlay)
    addToRecentlyPlayed(songToPlay)
    if (onPlayComplete) onPlayComplete()

    const params = new URLSearchParams({
      id:        songToPlay.id,
      title:     songToPlay.title,
      artist:    songToPlay.artist,
      thumbnail: songToPlay.thumbnail,
      type:      songToPlay.type,
      videoId:   songToPlay.videoId || songToPlay.id,
    })
    router.push(`/player?${params.toString()}`)
  }

  return (
    <div
      onClick={handlePlay}
      className="group relative bg-card/30 backdrop-blur-sm rounded-2xl p-4 cursor-pointer transition-all duration-300 hover:bg-card/50 hover:scale-105 hover:shadow-2xl border border-border/20"
    >
      <div className="relative aspect-square mb-3 overflow-hidden rounded-xl">
        <ImageWithFallback
          src={song.thumbnail || "/placeholder.svg"}
          alt={song.title}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
          fallback={
            <img
              src="https://via.placeholder.com/300x300/333/fff?text=Song"
              alt={song.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
            />
          }
        />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
          <div className="w-14 h-14 bg-primary rounded-full flex items-center justify-center">
            {resolving ? (
              <Loader2 className="w-6 h-6 text-primary-foreground animate-spin" />
            ) : (
              <Play className="w-6 h-6 text-primary-foreground ml-1" fill="currentColor" />
            )}
          </div>
        </div>
      </div>
      <h3 className="font-semibold text-sm text-foreground mb-1 truncate">{song.title}</h3>
      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
    </div>
  )
}
