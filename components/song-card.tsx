"use client"

import { useRouter } from "next/navigation"
import { Play } from "lucide-react"
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

  const handlePlay = () => {
    playSong(song)
    addToRecentlyPlayed(song)
    if (onPlayComplete) onPlayComplete()

    const params = new URLSearchParams({
      id: song.id,
      title: song.title,
      artist: song.artist,
      thumbnail: song.thumbnail,
      type: song.type,
      // Always pass videoId so the player can use it for YT embed
      videoId: song.videoId || song.id,
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
            <Play className="w-6 h-6 text-primary-foreground ml-1" fill="currentColor" />
          </div>
        </div>
      </div>
      <h3 className="font-semibold text-sm text-foreground mb-1 truncate">{song.title}</h3>
      <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
    </div>
  )
}
