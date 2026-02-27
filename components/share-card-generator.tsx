"use client"

import { useRef, useState, useCallback, useEffect } from "react"
import { Download, Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ShareCardProps {
  title:     string
  artist:    string
  thumbnail: string
}

type CardStyle = "dark" | "gradient" | "light" | "minimal"

const STYLES: { id: CardStyle; label: string }[] = [
  { id: "dark",     label: "Dark"     },
  { id: "gradient", label: "Gradient" },
  { id: "light",    label: "Light"    },
  { id: "minimal",  label: "Minimal"  },
]

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(" ")
  const lines: string[] = []
  let current = ""
  for (const word of words) {
    const test = current ? current + " " + word : word
    if (ctx.measureText(test).width > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = test
    }
    if (lines.length >= 1) { current = text.slice(lines.join(" ").length + 1); break }
  }
  if (current) lines.push(current)
  return lines.slice(0, 2)
}

async function loadProxiedImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    const proxy = `https://images.weserv.nl/?url=${encodeURIComponent(src)}&w=500&h=500&fit=cover&output=jpg`
    img.onload  = () => resolve(img)
    img.onerror = () => {
      // fallback — try direct
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

export default function ShareCardGenerator({ title, artist, thumbnail }: ShareCardProps) {
  const canvasRef        = useRef<HTMLCanvasElement>(null)
  const [style,    setStyle]   = useState<CardStyle>("dark")
  const [loading,  setLoading] = useState(false)
  const [rendered, setRendered]= useState(false)
  const [error,    setError]   = useState("")

  const renderCard = useCallback(async (cardStyle: CardStyle) => {
    const canvas = canvasRef.current
    if (!canvas) return
    setLoading(true)
    setError("")
    try {
      const W = 800, H = 800
      canvas.width  = W
      canvas.height = H
      const ctx = canvas.getContext("2d")!

      // Load album art
      let albumImg: HTMLImageElement | null = null
      try { albumImg = await loadProxiedImage(thumbnail) } catch { albumImg = null }

      // ─── Background ────────────────────────────────────────
      if (cardStyle === "dark") {
        // Blurred album art background
        ctx.fillStyle = "#0d0d0d"
        ctx.fillRect(0, 0, W, H)
        if (albumImg) {
          ctx.save()
          ctx.filter = "blur(40px) brightness(0.35)"
          ctx.drawImage(albumImg, -80, -80, W + 160, H + 160)
          ctx.filter = "none"
          ctx.restore()
        }
        // Dark vignette
        const vg = ctx.createRadialGradient(W/2, H/2, W*0.2, W/2, H/2, W*0.75)
        vg.addColorStop(0, "rgba(0,0,0,0)")
        vg.addColorStop(1, "rgba(0,0,0,0.6)")
        ctx.fillStyle = vg
        ctx.fillRect(0, 0, W, H)
      } else if (cardStyle === "gradient") {
        const [r, g, b] = albumImg ? sampleColor(albumImg) : [60, 40, 80]
        const dr = Math.max(0, r - 80), dg = Math.max(0, g - 80), db = Math.max(0, b - 80)
        const grad = ctx.createLinearGradient(0, 0, W, H)
        grad.addColorStop(0, `rgb(${r},${g},${b})`)
        grad.addColorStop(0.5, `rgb(${Math.round((r+dr)/2)},${Math.round((g+dg)/2)},${Math.round((b+db)/2)})`)
        grad.addColorStop(1, `rgb(${dr},${dg},${db})`)
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, W, H)
        // subtle noise texture overlay
        ctx.fillStyle = "rgba(0,0,0,0.15)"
        ctx.fillRect(0, 0, W, H)
      } else if (cardStyle === "light") {
        ctx.fillStyle = "#f8f5f0"
        ctx.fillRect(0, 0, W, H)
        // pastel circle decorations
        const [r, g, b] = albumImg ? sampleColor(albumImg) : [200, 180, 220]
        ctx.fillStyle = `rgba(${r},${g},${b},0.15)`
        ctx.beginPath(); ctx.arc(W - 120, 120, 280, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = `rgba(${r},${g},${b},0.08)`
        ctx.beginPath(); ctx.arc(80, H - 80, 200, 0, Math.PI * 2); ctx.fill()
      } else {
        // minimal — clean dark with accent strip
        ctx.fillStyle = "#111118"
        ctx.fillRect(0, 0, W, H)
        const [r, g, b] = albumImg ? sampleColor(albumImg) : [100, 80, 200]
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(0, 0, 8, H)
      }

      // ─── Album art card ─────────────────────────────────────
      const artSize = 420
      const artX    = (W - artSize) / 2
      const artY    = 110
      if (albumImg) {
        // Shadow
        ctx.save()
        ctx.shadowColor   = "rgba(0,0,0,0.55)"
        ctx.shadowBlur    = 60
        ctx.shadowOffsetY = 20
        roundRect(ctx, artX, artY, artSize, artSize, 28)
        ctx.fillStyle = "#111"
        ctx.fill()
        ctx.restore()
        // Clip and draw art
        ctx.save()
        roundRect(ctx, artX, artY, artSize, artSize, 28)
        ctx.clip()
        ctx.drawImage(albumImg, artX, artY, artSize, artSize)
        ctx.restore()
      } else {
        // Placeholder
        roundRect(ctx, artX, artY, artSize, artSize, 28)
        ctx.fillStyle = "#333"
        ctx.fill()
        ctx.fillStyle = "#666"
        ctx.font = "bold 80px sans-serif"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText("♪", artX + artSize/2, artY + artSize/2)
      }

      // ─── Info card ─────────────────────────────────────────
      const infoY  = artY + artSize + 28
      const infoH  = 150
      const infoX  = 60
      const infoW  = W - 120

      if (cardStyle === "light") {
        ctx.save()
        ctx.shadowColor = "rgba(0,0,0,0.08)"
        ctx.shadowBlur  = 20
        ctx.shadowOffsetY = 4
        roundRect(ctx, infoX, infoY, infoW, infoH, 20)
        ctx.fillStyle = "rgba(255,255,255,0.85)"
        ctx.fill()
        ctx.restore()
      } else {
        roundRect(ctx, infoX, infoY, infoW, infoH, 20)
        ctx.fillStyle = "rgba(255,255,255,0.07)"
        ctx.fill()
        roundRect(ctx, infoX, infoY, infoW, infoH, 20)
        ctx.strokeStyle = "rgba(255,255,255,0.12)"
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Title
      ctx.font = `bold 34px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      ctx.textAlign    = "left"
      ctx.textBaseline = "top"
      ctx.fillStyle    = cardStyle === "light" ? "#111" : "#fff"

      // Wrap title to 2 lines max
      const titleX = infoX + 24
      const titleMaxW = infoW - 48
      const titleLines = wrapText(ctx, title || "Unknown", titleMaxW)
      titleLines.forEach((line, i) => {
        ctx.fillText(line, titleX, infoY + 22 + i * 42)
      })

      // Artist
      const artistName = (artist || "Unknown").split(",")[0].trim()
      ctx.font      = `500 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      ctx.fillStyle = cardStyle === "light" ? "#555" : "rgba(255,255,255,0.6)"
      ctx.fillText(artistName, titleX, infoY + 22 + titleLines.length * 42 + 6)

      // ─── Branding ──────────────────────────────────────────
      const brandY = infoY + infoH + 28
      // Animated bars icon
      const barX = infoX
      const barColors = cardStyle === "light" ? ["#6366f1","#8b5cf6","#a78bfa","#c4b5fd"] : ["#a78bfa","#818cf8","#6366f1","#8b5cf6"]
      const barHeights = [24, 18, 30, 14]
      barHeights.forEach((bh, i) => {
        ctx.fillStyle = barColors[i % barColors.length]
        ctx.beginPath()
        ctx.roundRect?.(barX + i * 10, brandY + 16 - bh/2, 7, bh, 3) || roundRect(ctx, barX + i * 10, brandY + 16 - bh/2, 7, bh, 3)
        ctx.fill()
      })

      ctx.font      = `bold 20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
      ctx.fillStyle = cardStyle === "light" ? "#6366f1" : "#a78bfa"
      ctx.textBaseline = "middle"
      ctx.fillText("MUSICANA", barX + 52, brandY + 16)

      setRendered(true)
    } catch (e) {
      console.error(e)
      setError("Could not generate card. Check your connection.")
    } finally {
      setLoading(false)
    }
  }, [title, artist, thumbnail])

  useEffect(() => {
    renderCard(style)
  }, [style, renderCard])

  const handleSave = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], "musicana-share.png", { type: "image/png" })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: title, text: `${title} — ${artist}` })
        } else {
          const url = URL.createObjectURL(blob)
          const a   = document.createElement("a")
          a.href    = url
          a.download = "musicana-share.png"
          a.click()
          URL.revokeObjectURL(url)
        }
      }, "image/png")
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Style picker */}
      <div className="flex gap-2 justify-center">
        {STYLES.map(s => (
          <button
            key={s.id}
            onClick={() => setStyle(s.id)}
            className={[
              "px-3 py-1.5 rounded-full text-xs font-medium border transition-all",
              style === s.id
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card/40 text-muted-foreground border-border/40 hover:border-primary/50",
            ].join(" ")}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Canvas preview */}
      <div className="relative rounded-2xl overflow-hidden bg-muted/20 border border-border/30 aspect-square w-full max-w-xs mx-auto">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm z-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        )}
        <canvas
          ref={canvasRef}
          className="w-full h-full object-contain"
          style={{ display: "block" }}
        />
      </div>

      {error && <p className="text-xs text-red-400 text-center">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-2 rounded-xl"
          onClick={() => renderCard(style)}
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
