"use client"

import type React from "react"
import { usePathname, useRouter } from "next/navigation"
import { Play, Pause, X, SkipForward, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAudio } from "@/lib/audio-context"
import ImageWithFallback from "./image-with-fallback"

export default function MiniPlayer() {
  const pathname = usePathname()
  const router   = useRouter()
  const {
    currentSong, isPlaying, isLoading,
    togglePlayPause, currentTime, duration,
    seek, stopSong, playNext, queue, queueIndex,
  } = useAudio()

  if (pathname === "/player" || !currentSong) return null

  const progress  = duration > 0 ? (currentTime / duration) * 100 : 0
  const hasNext   = queueIndex < queue.length - 1

  const openPlayer = () =>
    router.push(
      `/player?id=${encodeURIComponent(currentSong.id)}&title=${encodeURIComponent(currentSong.title)}&artist=${encodeURIComponent(currentSong.artist)}&thumbnail=${encodeURIComponent(currentSong.thumbnail)}&type=${currentSong.type}&videoId=${encodeURIComponent(currentSong.videoId || currentSong.id)}`
    )

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    seek(((e.clientX - rect.left) / rect.width) * duration)
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border/60 shadow-2xl">
      {/* Progress bar */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 bg-muted cursor-pointer group"
        onClick={handleProgressClick}
      >
        <div
          className="h-full bg-primary transition-all duration-300 relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm" />
        </div>
      </div>

      <div className="container mx-auto px-4 py-2.5">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Thumbnail + song info */}
          <button
            onClick={openPlayer}
            className="flex items-center gap-3 flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
          >
            <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-muted">
              <ImageWithFallback
                src={currentSong.thumbnail || "/placeholder.svg"}
                alt={currentSong.title}
                className="w-full h-full object-cover"
                fallback={
                  <img
                    src="https://via.placeholder.com/44?text=♪"
                    alt={currentSong.title}
                    className="w-full h-full object-cover"
                  />
                }
              />
              {isLoading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 text-white animate-spin" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground truncate">{currentSong.title}</p>
              <p className="text-xs text-muted-foreground truncate">{currentSong.artist}</p>
            </div>
          </button>

          {/* Controls */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost" size="icon"
              onClick={togglePlayPause}
              disabled={isLoading}
              className="rounded-full w-10 h-10 hover:bg-primary/20"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-5 h-5" fill="currentColor" />
              ) : (
                <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
              )}
            </Button>

            {hasNext && (
              <Button
                variant="ghost" size="icon"
                onClick={playNext}
                className="rounded-full w-10 h-10 hover:bg-primary/20"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            )}

            <Button
              variant="ghost" size="icon"
              onClick={stopSong}
              className="rounded-full w-10 h-10 hover:bg-destructive/20 text-muted-foreground"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
