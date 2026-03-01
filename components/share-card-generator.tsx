"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Download, Loader2, RefreshCw, Music, Quote, Languages } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { LyricLine } from "@/lib/types"

interface ShareCardProps {
  title:              string
  artist:             string
  thumbnail:          string
  lyrics?:            LyricLine[]
  currentLyricIndex?: number
  /** AI-transformed lines — same length as lyrics */
  translatedLines?:   string[] | null
  /** What kind of transform: "translate" | "transliterate" */
  translationMode?:   "translate" | "transliterate" | null
}

type CardStyle   = "dark" | "gradient" | "light" | "minimal" | "lyrics"
type LyricSource = "original" | "translated"

const STYLES: { id: CardStyle; label: string; emoji: string }[] = [
  { id: "dark",     label: "Dark",     emoji: "🌑" },
  { id: "gradient", label: "Gradient", emoji: "🎨" },
  { id: "light",    label: "Light",    emoji: "☀️"  },
  { id: "minimal",  label: "Minimal",  emoji: "◽" },
  { id: "lyrics",   label: "Lyrics",   emoji: "🎤" },
]

/* ─── canvas helpers ─────────────────────────────────────── */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines = 2,
): string[] {
  const words   = text.split(" ")
  const lines: string[] = []
  let   current = ""
  for (const word of words) {
    const test = current ? current + " " + word : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
      if (lines.length >= maxLines) break
    } else {
      current = test
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines.slice(0, maxLines)
}

function wrapLyricLine(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  if (!text) return []
  if (ctx.measureText(text).width <= maxWidth) return [text]
  const words   = text.split(" ")
  const lines: string[] = []
  let   current = ""
  for (const word of words) {
    const test = current ? current + " " + word : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current); current = word
    } else { current = test }
  }
  if (current) lines.push(current)
  return lines
}

async function loadProxiedImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    const proxy = `https://images.weserv.nl/?url=${encodeURIComponent(src)}&w=600&h=600&fit=cover&output=jpg`
    img.onload  = () => resolve(img)
    img.onerror = () => {
      const img2 = new Image()
      img2.crossOrigin = "anonymous"
      img2.onload  = () => resolve(img2)
      img2.onerror = reject
      img2.src = src
    }
    img.src = proxy
  })
}

function sampleColor(img: HTMLImageElement): [number, number, number] {
  try {
    const tmp = document.createElement("canvas")
    tmp.width = tmp.height = 1
    const ctx = tmp.getContext("2d")!
    ctx.drawImage(img, 0, 0, 1, 1)
    const d = ctx.getImageData(0, 0, 1, 1).data
    return [d[0], d[1], d[2]]
  } catch { return [30, 30, 50] }
}

function fmtTime(ms: number): string {
  const s   = Math.floor(ms / 1000)
  const min = Math.floor(s / 60)
  const sec = s % 60
  return `${min}:${sec.toString().padStart(2, "0")}`
}

/* ─── Component ──────────────────────────────────────────── */
export default function ShareCardGenerator({
  title, artist, thumbnail,
  lyrics = [], currentLyricIndex = -1,
  translatedLines = null, translationMode = null,
}: ShareCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [style,        setStyle]        = useState<CardStyle>("dark")
  const [lyricSource,  setLyricSource]  = useState<LyricSource>("original")
  const [loading,      setLoading]      = useState(false)
  const [rendered,     setRendered]     = useState(false)
  const [error,        setError]        = useState("")

  const hasLyrics     = lyrics.length > 0
  const hasTranslated = !!(translatedLines && translatedLines.length > 0)

  const defaultStart = currentLyricIndex >= 0
    ? Math.max(0, currentLyricIndex - 1)
    : 0
  const [selectedStart, setSelectedStart] = useState(defaultStart)
  const LINES_PER_CARD = 4

  // When no translated lines available, always force original
  useEffect(() => {
    if (!hasTranslated) setLyricSource("original")
  }, [hasTranslated])

  useEffect(() => {
    if (currentLyricIndex >= 0) {
      setSelectedStart(Math.max(0, currentLyricIndex - 1))
    }
  }, [currentLyricIndex])

  const effectiveStyle = (style === "lyrics" && !hasLyrics) ? "dark" : style

  // Label for the translated toggle button
  const transLabel = translationMode === "translate"
    ? "Translated"
    : translationMode === "transliterate"
    ? "Transliterated"
    : "Translated"

  // Get text for a lyric line based on selected source
  const getLineText = (lineIdx: number): string => {
    if (lyricSource === "translated" && hasTranslated && translatedLines) {
      return translatedLines[lineIdx] ?? lyrics[lineIdx]?.text ?? ""
    }
    return lyrics[lineIdx]?.text ?? ""
  }

  const renderCard = useCallback(async (cardStyle: CardStyle, selStart: number, source: LyricSource) => {
    const canvas = canvasRef.current
    if (!canvas) return
    setLoading(true)
    setError("")
    try {
      const W = 800, H = 800
      canvas.width  = W
      canvas.height = H
      const ctx = canvas.getContext("2d")!

      let albumImg: HTMLImageElement | null = null
      try { albumImg = await loadProxiedImage(thumbnail) } catch { albumImg = null }

      const [r, g, b] = albumImg ? sampleColor(albumImg) : [60, 40, 80]

      /* ════════════════════════════════════════════════════════
         LYRICS CARD
         ════════════════════════════════════════════════════════ */
      if (cardStyle === "lyrics") {
        ctx.fillStyle = "#0a0a10"
        ctx.fillRect(0, 0, W, H)
        if (albumImg) {
          ctx.save()
          ctx.filter = "blur(50px) brightness(0.2) saturate(1.5)"
          ctx.drawImage(albumImg, -100, -100, W + 200, H + 200)
          ctx.filter = "none"
          ctx.restore()
        }
        const ov = ctx.createLinearGradient(0, 0, 0, H)
        ov.addColorStop(0, "rgba(10,10,16,0.6)")
        ov.addColorStop(0.4, "rgba(10,10,16,0.3)")
        ov.addColorStop(1, "rgba(10,10,16,0.85)")
        ctx.fillStyle = ov
        ctx.fillRect(0, 0, W, H)

        const accentGrad = ctx.createLinearGradient(0, 0, 0, H)
        accentGrad.addColorStop(0, `rgba(${r},${g},${b},0.9)`)
        accentGrad.addColorStop(1, `rgba(${r},${g},${b},0.3)`)
        ctx.fillStyle = accentGrad
        ctx.fillRect(0, 0, 6, H)

        // Small album art
        const thumbSize = 120, thumbX = 48, thumbY = 52
        if (albumImg) {
          ctx.save()
          ctx.shadowColor   = "rgba(0,0,0,0.6)"
          ctx.shadowBlur    = 24
          ctx.shadowOffsetY = 8
          roundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 16)
          ctx.fillStyle = "#222"
          ctx.fill()
          ctx.restore()
          ctx.save()
          roundRect(ctx, thumbX, thumbY, thumbSize, thumbSize, 16)
          ctx.clip()
          ctx.drawImage(albumImg, thumbX, thumbY, thumbSize, thumbSize)
          ctx.restore()
        }

        // Song info beside thumbnail
        const infoX    = thumbX + thumbSize + 22
        const infoMaxW = W - infoX - 48
        ctx.textBaseline = "top"
        ctx.textAlign    = "left"
        ctx.font = `bold 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        ctx.fillStyle = "#ffffff"
        const titleLines = wrapText(ctx, title || "Unknown", infoMaxW, 2)
        titleLines.forEach((line, i) => ctx.fillText(line, infoX, thumbY + 8 + i * 36))

        ctx.font      = `500 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        ctx.fillStyle = "rgba(255,255,255,0.55)"
        const artistShort = (artist || "Unknown").split(",")[0].trim()
        ctx.fillText(artistShort, infoX, thumbY + 8 + titleLines.length * 36 + 4)

        // Translation mode badge (if applicable)
        if (source === "translated" && hasTranslated) {
          const badgeLabel = translationMode === "translate" ? "🌐 Translated" : "🔤 Transliterated"
          ctx.font = `600 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
          const bw = ctx.measureText(badgeLabel).width + 20
          const bx = infoX, by = thumbY + 8 + titleLines.length * 36 + 32
          roundRect(ctx, bx, by, bw, 24, 12)
          ctx.fillStyle = `rgba(${r},${g},${b},0.4)`
          ctx.fill()
          ctx.fillStyle = "rgba(255,255,255,0.85)"
          ctx.textBaseline = "middle"
          ctx.fillText(badgeLabel, bx + 10, by + 12)
          ctx.textBaseline = "top"
        }

        // Divider
        const divY = thumbY + thumbSize + 40
        ctx.strokeStyle = "rgba(255,255,255,0.08)"
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(48, divY)
        ctx.lineTo(W - 48, divY)
        ctx.stroke()

        // Quote icon
        const quoteY = divY + 28
        ctx.font      = `bold 56px serif`
        ctx.fillStyle = `rgba(${r},${g},${b},0.45)`
        ctx.fillText("\u201C", 48, quoteY)

        // Lyric lines (using source-aware text)
        const lyricStartY = quoteY + 44
        const lyricMaxW   = W - 96
        let   curY        = lyricStartY

        for (let lineIdx = selStart; lineIdx < selStart + LINES_PER_CARD && lineIdx < lyrics.length; lineIdx++) {
          const line     = lyrics[lineIdx]
          const isActive = lineIdx === currentLyricIndex
          const text     = source === "translated" && hasTranslated && translatedLines
            ? (translatedLines[lineIdx] ?? line.text)
            : line.text
          const wrapped  = wrapLyricLine(ctx, text, lyricMaxW)

          // Timestamp pill
          const tsText = fmtTime(line.start_time)
          ctx.font = `500 14px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
          const tsW = ctx.measureText(tsText).width + 16
          ctx.fillStyle = isActive ? `rgba(${r},${g},${b},0.6)` : "rgba(255,255,255,0.08)"
          roundRect(ctx, W - 48 - tsW, curY - 2, tsW, 22, 11)
          ctx.fill()
          ctx.fillStyle  = isActive ? "#fff" : "rgba(255,255,255,0.35)"
          ctx.textAlign  = "right"
          ctx.fillText(tsText, W - 48 - 8, curY + 1)
          ctx.textAlign  = "left"

          wrapped.forEach((wline, wi) => {
            ctx.font      = isActive
              ? `bold 32px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
              : `400 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
            ctx.fillStyle = isActive ? "#ffffff" : "rgba(255,255,255,0.45)"
            ctx.textBaseline = "top"
            ctx.fillText(wline, 48, curY + wi * 36)
          })
          curY += wrapped.length * 36 + 20
        }

        // Closing quote
        ctx.font      = `bold 56px serif`
        ctx.fillStyle = `rgba(${r},${g},${b},0.45)`
        ctx.textAlign = "left"
        ctx.fillText("\u201D", W - 80, curY + 4)

        // Branding
        const brandY    = H - 60
        const barColors = ["#a78bfa","#818cf8","#6366f1","#8b5cf6"]
        const barHeights = [20, 28, 16, 24]
        barHeights.forEach((bh, i) => {
          ctx.fillStyle = barColors[i % barColors.length]
          ctx.beginPath()
          roundRect(ctx, 48 + i * 10, brandY + 14 - bh / 2, 7, bh, 3)
          ctx.fill()
        })
        ctx.font      = `bold 18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        ctx.fillStyle = "#a78bfa"
        ctx.textBaseline = "middle"
        ctx.fillText("Musicanaz", 48 + 50, brandY + 14)

        ctx.font      = `400 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
        ctx.fillStyle = "rgba(255,255,255,0.25)"
        ctx.textAlign = "right"
        ctx.fillText("musicanaz.vercel.app", W - 48, brandY + 14)

        setRendered(true)
        return
      }

      /* ════════════════════════════════════════════════════════
         STANDARD CARDS (dark / gradient / light / minimal)
         ════════════════════════════════════════════════════════ */
      if (cardStyle === "dark") {
        ctx.fillStyle = "#0d0d0d"
        ctx.fillRect(0, 0, W, H)
        if (albumImg) {
          ctx.save()
          ctx.filter = "blur(40px) brightness(0.35)"
          ctx.drawImage(albumImg, -80, -80, W + 160, H + 160)
          ctx.filter = "none"
          ctx.restore()
        }
        const vg = ctx.createRadialGradient(W/2, H/2, W*0.2, W/2, H/2, W*0.75)
        vg.addColorStop(0, "rgba(0,0,0,0)")
        vg.addColorStop(1, "rgba(0,0,0,0.6)")
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H)
      } else if (cardStyle === "gradient") {
        const dr = Math.max(0, r - 80), dg = Math.max(0, g - 80), db = Math.max(0, b - 80)
        const grad = ctx.createLinearGradient(0, 0, W, H)
        grad.addColorStop(0, `rgb(${r},${g},${b})`)
        grad.addColorStop(0.5, `rgb(${Math.round((r+dr)/2)},${Math.round((g+dg)/2)},${Math.round((b+db)/2)})`)
        grad.addColorStop(1, `rgb(${dr},${dg},${db})`)
        ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = "rgba(0,0,0,0.15)"; ctx.fillRect(0, 0, W, H)
      } else if (cardStyle === "light") {
        ctx.fillStyle = "#f8f5f0"; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = `rgba(${r},${g},${b},0.15)`
        ctx.beginPath(); ctx.arc(W - 120, 120, 280, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = `rgba(${r},${g},${b},0.08)`
        ctx.beginPath(); ctx.arc(80, H - 80, 200, 0, Math.PI * 2); ctx.fill()
      } else {
        ctx.fillStyle = "#111118"; ctx.fillRect(0, 0, W, H)
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(0, 0, 8, H)
      }

      // Album art
      const artSize = 420, artX = (W - artSize) / 2, artY = 110
      if (albumImg) {
        ctx.save()
        ctx.shadowColor = "rgba(0,0,0,0.55)"
        ctx.shadowBlur = 60; ctx.shadowOffsetY = 20
        roundRect(ctx, artX, artY, artSize, artSize, 28)
        ctx.fillStyle = "#111"; ctx.fill()
        ctx.restore()
        ctx.save()
        roundRect(ctx, artX, artY, artSize, artSize, 28)
        ctx.clip()
        ctx.drawImage(albumImg, artX, artY, artSize, artSize)
        ctx.restore()
      } else {
        roundRect(ctx, artX, artY, artSize, artSize, 28)
        ctx.fillStyle = "#333"; ctx.fill()
        ctx.fillStyle = "#666"
        ctx.font = "bold 80px sans-serif"
        ctx.textAlign = "center"; ctx.textBaseline = "middle"
        ctx.fillText("♪", artX + artSize/2, artY + artSize/2)
      }

      // Info card
      const infoY = artY + artSize + 28
      const infoH = 150, infoX = 60, infoW = W - 120
      if (cardStyle === "light") {
        ctx.save()
        ctx.shadowColor = "rgba(0,0,0,0.08)"; ctx.shadowBlur = 20; ctx.shadowOffsetY = 4
        roundRect(ctx, infoX, infoY, infoW, infoH, 20)
        ctx.fillStyle = "rgba(255,255,255,0.85)"; ctx.fill()
        ctx.restore()
      } else {
        roundRect(ctx, infoX, infoY, infoW, infoH, 20)
        ctx.fillStyle = "rgba(255,255,255,0.07)"; ctx.fill()
        roundRect(ctx, infoX, infoY, infoW, infoH, 20)
        ctx.strokeStyle = "rgba(255,255,255,0.12)"; ctx.lineWidth = 1; ctx.stroke()
      }

      ctx.font = `bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      ctx.textAlign = "left"; ctx.textBaseline = "top"
      ctx.fillStyle = cardStyle === "light" ? "#111" : "#fff"
      const titleLines = wrapText(ctx, title || "Unknown", infoW - 48)
      titleLines.forEach((line, i) => ctx.fillText(line, infoX + 24, infoY + 22 + i * 42))

      ctx.font = `500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      ctx.fillStyle = cardStyle === "light" ? "#555" : "rgba(255,255,255,0.6)"
      ctx.fillText((artist || "Unknown").split(",")[0].trim(), infoX + 24, infoY + 22 + titleLines.length * 42 + 6)

      // Branding
      const brandY = infoY + infoH + 28
      const barColors = cardStyle === "light"
        ? ["#6366f1","#8b5cf6","#a78bfa","#c4b5fd"]
        : ["#a78bfa","#818cf8","#6366f1","#8b5cf6"]
      ;[24, 18, 30, 14].forEach((bh, i) => {
        ctx.fillStyle = barColors[i % barColors.length]
        ctx.beginPath()
        roundRect(ctx, infoX + i * 10, brandY + 16 - bh/2, 7, bh, 3)
        ctx.fill()
      })
      ctx.font = `bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      ctx.fillStyle = cardStyle === "light" ? "#6366f1" : "#a78bfa"
      ctx.textBaseline = "middle"
      ctx.fillText("Musicanaz", infoX + 52, brandY + 16)

      setRendered(true)
    } catch (e) {
      console.error(e)
      setError("Could not generate card. Check your connection.")
    } finally {
      setLoading(false)
    }
  }, [title, artist, thumbnail, lyrics, currentLyricIndex, translatedLines, translationMode, hasTranslated])

  useEffect(() => {
    renderCard(effectiveStyle, selectedStart, lyricSource)
  }, [effectiveStyle, selectedStart, lyricSource, renderCard])

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], "musicanaz-share.png", { type: "image/png" })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title, text: `${title} — ${artist}` })
        } else {
          const url = URL.createObjectURL(blob)
          const a = document.createElement("a")
          a.href = url; a.download = "musicanaz-share.png"; a.click()
          URL.revokeObjectURL(url)
        }
      }, "image/png")
    } catch (e) { console.error(e) }
  }

  const availableLines = lyrics.length > 0
    ? Math.max(0, lyrics.length - LINES_PER_CARD + 1)
    : 0

  return (
    <div className="flex flex-col gap-3">

      {/* Style picker */}
      <div className="flex gap-1.5 justify-center flex-wrap">
        {STYLES.map(s => {
          const disabled = s.id === "lyrics" && !hasLyrics
          return (
            <button
              key={s.id}
              onClick={() => !disabled && setStyle(s.id)}
              disabled={disabled}
              title={disabled ? "No lyrics available for this song" : undefined}
              className={[
                "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
                style === s.id && !disabled
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : disabled
                  ? "opacity-30 cursor-not-allowed bg-card/20 text-muted-foreground border-border/20"
                  : "bg-card/40 text-muted-foreground border-border/40 hover:border-primary/50 hover:bg-card/60",
              ].join(" ")}
            >
              <span>{s.emoji}</span>
              <span>{s.label}</span>
              {s.id === "lyrics" && !hasLyrics && (
                <span className="text-[9px] opacity-60 ml-0.5">N/A</span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Lyrics mode controls ── */}
      {effectiveStyle === "lyrics" && hasLyrics && (

        <div className="space-y-2">

          {/* Translation source toggle — only shown when translated lines exist */}
          {hasTranslated && (
            <div className="flex items-center gap-2 rounded-2xl bg-card/40 border border-border/30 p-2">
              <Languages className="w-3.5 h-3.5 text-primary flex-shrink-0 ml-1" />
              <span className="text-xs text-muted-foreground font-medium flex-shrink-0">Lyrics:</span>
              <div className="flex gap-1 flex-1">
                <button
                  onClick={() => setLyricSource("original")}
                  className={[
                    "flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                    lyricSource === "original"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card/30 text-muted-foreground border-border/20 hover:text-foreground",
                  ].join(" ")}
                >
                  Original
                </button>
                <button
                  onClick={() => setLyricSource("translated")}
                  className={[
                    "flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all border",
                    lyricSource === "translated"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card/30 text-muted-foreground border-border/20 hover:text-foreground",
                  ].join(" ")}
                >
                  {transLabel}
                </button>
              </div>
            </div>
          )}

          {/* Lyric line-picker */}
          {availableLines > 0 && (
            <div className="rounded-2xl bg-card/40 border border-border/30 p-3">
              <div className="flex items-center gap-2 mb-2.5">
                <Quote className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                <p className="text-xs font-semibold text-muted-foreground">
                  Select lyric section ({LINES_PER_CARD} lines shown)
                </p>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                {lyrics.slice(0, lyrics.length - LINES_PER_CARD + 1).map((line, i) => {
                  const isSelected = i === selectedStart
                  const isCurrent  = i === currentLyricIndex || (currentLyricIndex >= i && currentLyricIndex < i + LINES_PER_CARD)
                  // Display text uses selected source
                  const displayText = lyricSource === "translated" && hasTranslated && translatedLines
                    ? (translatedLines[i] ?? line.text)
                    : line.text
                  return (
                    <button
                      key={line.id}
                      onClick={() => setSelectedStart(i)}
                      className={[
                        "w-full text-left flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-all text-xs",
                        isSelected
                          ? "bg-primary/15 border border-primary/30 text-foreground"
                          : "hover:bg-card/60 text-muted-foreground border border-transparent",
                      ].join(" ")}
                    >
                      <span className={[
                        "font-mono text-[10px] tabular-nums flex-shrink-0 px-1.5 py-0.5 rounded-md",
                        isCurrent ? "bg-primary/20 text-primary" : "bg-muted/40 text-muted-foreground/60",
                      ].join(" ")}>
                        {fmtTime(line.start_time)}
                      </span>
                      <span className={`truncate leading-tight ${isSelected ? "font-medium text-foreground" : ""}`}>
                        {displayText}
                      </span>
                      {isCurrent && (
                        <span className="ml-auto flex-shrink-0 text-[9px] text-primary font-semibold">NOW</span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Preview */}
              <div className="mt-2.5 pt-2.5 border-t border-border/20">
                <p className="text-[10px] text-muted-foreground/50 mb-1.5 font-medium uppercase tracking-wider">
                  Will appear on card:
                </p>
                <div className="space-y-0.5">
                  {lyrics.slice(selectedStart, selectedStart + LINES_PER_CARD).map((line, i) => {
                    const text = lyricSource === "translated" && hasTranslated && translatedLines
                      ? (translatedLines[selectedStart + i] ?? line.text)
                      : line.text
                    return (
                      <p
                        key={line.id}
                        className={`text-xs leading-snug truncate ${
                          selectedStart + i === currentLyricIndex
                            ? "text-foreground font-semibold"
                            : "text-muted-foreground/60"
                        }`}
                      >
                        {text}
                      </p>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Canvas preview */}
      <div className="relative rounded-2xl overflow-hidden bg-muted/20 border border-border/30 aspect-square w-full max-w-xs mx-auto">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        <canvas ref={canvasRef} className="w-full h-full object-contain" style={{ display: "block" }} />
      </div>

      {error && <p className="text-xs text-red-400 text-center">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline" size="sm"
          className="flex-1 gap-2 rounded-xl"
          onClick={() => renderCard(effectiveStyle, selectedStart, lyricSource)}
          disabled={loading}
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
        <Button
          size="sm"
          className="flex-1 gap-2 rounded-xl"
          onClick={handleSave}
          disabled={loading || !rendered}
        >
          <Download className="w-3.5 h-3.5" />
          Save Card
        </Button>
      </div>
    </div>
  )
}
