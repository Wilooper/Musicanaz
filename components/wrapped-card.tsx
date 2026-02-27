"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import {
  Download, Share2, X, Sparkles, RotateCcw, Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getAllTimeTopSongs, getAllTimeListenSeconds,
  getHeatmapData, fmtListenTime,
  type TopSong, type HeatmapDay,
  getPartyUsername,
} from "@/lib/storage"

/* ── helpers ──────────────────────────────────────────────── */
const W = 900
const H = 1600

// Load an image cross-origin through weserv proxy so canvas doesn't taint
function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed: ${src}`))
    img.src = src
  })
}

function proxyThumb(url: string, size = 200) {
  if (!url) return ""
  return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=${size}&h=${size}&output=jpg&q=85`
}

// Round-rect helper (works in all browsers)
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// Draw thumbnail clipped to rounded rect
function drawThumb(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  x: number, y: number, s: number, r: number,
) {
  ctx.save()
  roundRect(ctx, x, y, s, s, r)
  ctx.clip()
  if (img) {
    // cover-fit
    const scale = Math.max(s / img.width, s / img.height)
    const sw = img.width  * scale
    const sh = img.height * scale
    ctx.drawImage(img, x + (s - sw) / 2, y + (s - sh) / 2, sw, sh)
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.08)"
    ctx.fill()
  }
  ctx.restore()
}

/* ── main render ─────────────────────────────────────────── */
async function renderWrapped(
  canvas: HTMLCanvasElement,
  top: TopSong[],
  heat: HeatmapDay[],
  totalSecs: number,
  username: string,
) {
  const ctx = canvas.getContext("2d")!
  canvas.width  = W
  canvas.height = H

  // ── Background gradient ─────────────────────────────────
  const bg = ctx.createLinearGradient(0, 0, W * 0.5, H)
  bg.addColorStop(0,   "#0f0f1a")
  bg.addColorStop(0.4, "#12082a")
  bg.addColorStop(1,   "#0a0a14")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  // Subtle radial glow top-left
  const glow1 = ctx.createRadialGradient(W * 0.15, H * 0.05, 0, W * 0.15, H * 0.05, W * 0.7)
  glow1.addColorStop(0,   "rgba(99,102,241,0.25)")
  glow1.addColorStop(0.5, "rgba(99,102,241,0.06)")
  glow1.addColorStop(1,   "transparent")
  ctx.fillStyle = glow1
  ctx.fillRect(0, 0, W, H)

  // Bottom-right glow
  const glow2 = ctx.createRadialGradient(W * 0.9, H * 0.85, 0, W * 0.9, H * 0.85, W * 0.6)
  glow2.addColorStop(0,   "rgba(168,85,247,0.22)")
  glow2.addColorStop(1,   "transparent")
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, W, H)

  const PAD = 56
  let y = 0

  // ── Logo + branding strip ──────────────────────────────
  y = 64
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  ctx.letterSpacing = "4px"
  ctx.fillText("MUSICANA", PAD, y)
  ctx.letterSpacing = "0px"

  const now  = new Date()
  const yr   = now.getFullYear()
  const mon  = now.toLocaleString("en", { month: "long" })
  ctx.font      = "600 22px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.22)"
  ctx.fillText(`${mon} ${yr}`, PAD, y + 38)

  // Accent line
  const lineGrad = ctx.createLinearGradient(PAD, 0, PAD + 260, 0)
  lineGrad.addColorStop(0, "rgba(99,102,241,0.9)")
  lineGrad.addColorStop(1, "rgba(168,85,247,0.0)")
  ctx.fillStyle = lineGrad
  ctx.fillRect(PAD, y + 52, 260, 2)

  // ── Username ───────────────────────────────────────────
  y += 100
  ctx.font      = "800 72px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.95)"
  const displayName = username && username !== "Guest" ? username : "Your"
  ctx.fillText(displayName, PAD, y)
  y += 12
  ctx.font      = "700 52px system-ui, -apple-system, sans-serif"
  const titleGrad = ctx.createLinearGradient(PAD, y, PAD + 400, y + 60)
  titleGrad.addColorStop(0, "#818cf8")
  titleGrad.addColorStop(1, "#c084fc")
  ctx.fillStyle = titleGrad
  ctx.fillText("2025 Wrapped", PAD, y + 60)

  // ── Total listen time big card ─────────────────────────
  y += 120
  const cardH = 170
  roundRect(ctx, PAD, y, W - PAD * 2, cardH, 24)
  const cardGrad = ctx.createLinearGradient(PAD, y, W - PAD, y + cardH)
  cardGrad.addColorStop(0, "rgba(99,102,241,0.20)")
  cardGrad.addColorStop(1, "rgba(168,85,247,0.12)")
  ctx.fillStyle = cardGrad
  ctx.fill()
  roundRect(ctx, PAD, y, W - PAD * 2, cardH, 24)
  ctx.strokeStyle = "rgba(99,102,241,0.35)"
  ctx.lineWidth   = 1.5
  ctx.stroke()

  ctx.font      = "500 22px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.45)"
  ctx.fillText("⏱  Total time listened", PAD + 28, y + 44)

  ctx.font      = "800 66px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "#ffffff"
  const timeStr = fmtListenTime(totalSecs) || "0s"
  ctx.fillText(timeStr, PAD + 28, y + 122)

  const songsPlayed = top.reduce((a, b) => a + b.plays, 0)
  ctx.font      = "500 22px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.38)"
  ctx.fillText(`across ${songsPlayed} plays`, PAD + 28, y + 158)

  // ── Heatmap ────────────────────────────────────────────
  y += cardH + 48

  ctx.font      = "700 28px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.65)"
  ctx.fillText("Activity", PAD, y)
  ctx.font      = "500 21px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.28)"
  ctx.fillText("last 26 weeks", PAD + 114, y - 1)
  y += 20

  const CELL = 13
  const GAP  = 3
  const COLS = 26
  const ROWS = 7
  const HEAT_COLORS = [
    "rgba(255,255,255,0.07)",
    "rgba(99,102,241,0.25)",
    "rgba(99,102,241,0.50)",
    "rgba(99,102,241,0.75)",
    "rgba(99,102,241,1.00)",
  ]
  const hmW  = COLS * (CELL + GAP) - GAP
  const hmX  = PAD
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const idx = col * 7 + row
      const day = heat[idx]
      ctx.fillStyle = day ? HEAT_COLORS[day.level] : HEAT_COLORS[0]
      const cx = hmX + col * (CELL + GAP)
      const cy = y  + row * (CELL + GAP)
      roundRect(ctx, cx, cy, CELL, CELL, 3)
      ctx.fill()
    }
  }
  y += ROWS * (CELL + GAP) + 36

  // ── #1 Most Played ─────────────────────────────────────
  const no1 = top[0]
  if (no1) {
    ctx.font      = "700 28px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.65)"
    ctx.fillText("🏆  Most Played Song", PAD, y)
    y += 22

    const no1H = 160
    roundRect(ctx, PAD, y, W - PAD * 2, no1H, 22)
    const no1Grad = ctx.createLinearGradient(PAD, y, W - PAD, y + no1H)
    no1Grad.addColorStop(0, "rgba(234,179,8,0.18)")
    no1Grad.addColorStop(1, "rgba(251,146,60,0.08)")
    ctx.fillStyle = no1Grad
    ctx.fill()
    roundRect(ctx, PAD, y, W - PAD * 2, no1H, 22)
    ctx.strokeStyle = "rgba(234,179,8,0.35)"
    ctx.lineWidth   = 1.5
    ctx.stroke()

    // Thumbnail
    const thumbSize = 100
    let no1Img: HTMLImageElement | null = null
    try {
      no1Img = no1.song.thumbnail ? await loadImg(proxyThumb(no1.song.thumbnail)) : null
    } catch {}
    drawThumb(ctx, no1Img, PAD + 24, y + 30, thumbSize, 14)

    ctx.font      = "800 30px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "#facc15"
    ctx.fillText("#1", PAD + 24, y + 26)

    const txtX = PAD + 24 + thumbSize + 20
    ctx.font      = "700 28px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.95)"
    // Truncate long titles
    let t = no1.song.title
    ctx.font = "700 28px system-ui, -apple-system, sans-serif"
    while (t.length > 3 && ctx.measureText(t).width > W - PAD * 2 - thumbSize - 80) t = t.slice(0, -4) + "…"
    ctx.fillText(t, txtX, y + 68)

    ctx.font      = "500 22px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.50)"
    let ar = no1.song.artist
    while (ar.length > 3 && ctx.measureText(ar).width > W - PAD * 2 - thumbSize - 80) ar = ar.slice(0, -4) + "…"
    ctx.fillText(ar, txtX, y + 98)

    ctx.font      = "700 24px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "#facc15"
    ctx.fillText(`${no1.plays} plays`, txtX, y + 135)

    y += no1H + 40
  }

  // ── Top 5 Songs ────────────────────────────────────────
  const topFive = top.slice(0, 5)
  if (topFive.length) {
    ctx.font      = "700 28px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.65)"
    ctx.fillText("🎵  Top Songs", PAD, y)
    y += 22

    const rowH = 88
    const RANK_COLORS = ["#facc15", "#d1d5db", "#fb923c", "#818cf8", "#818cf8"]

    for (let i = 0; i < topFive.length; i++) {
      const entry = topFive[i]
      // Row background
      roundRect(ctx, PAD, y, W - PAD * 2, rowH - 6, 18)
      ctx.fillStyle = i === 0
        ? "rgba(255,255,255,0.06)"
        : "rgba(255,255,255,0.03)"
      ctx.fill()

      // Thumbnail
      const ts = 58
      let img: HTMLImageElement | null = null
      try {
        img = entry.song.thumbnail ? await loadImg(proxyThumb(entry.song.thumbnail, 100)) : null
      } catch {}
      drawThumb(ctx, img, PAD + 70, y + (rowH - 6 - ts) / 2, ts, 10)

      // Rank number
      ctx.font      = `800 ${i < 3 ? 32 : 26}px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = RANK_COLORS[i]
      ctx.textAlign = "center"
      ctx.fillText(`${i + 1}`, PAD + 36, y + rowH / 2 + 10)
      ctx.textAlign = "left"

      // Title + artist
      const infoX = PAD + 70 + ts + 20
      const maxW  = W - PAD - infoX - 110
      ctx.font = "600 24px system-ui, -apple-system, sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.92)"
      let title = entry.song.title
      while (title.length > 3 && ctx.measureText(title).width > maxW) title = title.slice(0, -4) + "…"
      ctx.fillText(title, infoX, y + rowH / 2 - 4)

      ctx.font      = "500 20px system-ui, -apple-system, sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.40)"
      let artist = entry.song.artist
      while (artist.length > 3 && ctx.measureText(artist).width > maxW) artist = artist.slice(0, -4) + "…"
      ctx.fillText(artist, infoX, y + rowH / 2 + 26)

      // Plays badge
      const badge = `${entry.plays}×`
      ctx.font      = "700 22px system-ui, -apple-system, sans-serif"
      ctx.fillStyle = "rgba(129,140,248,0.90)"
      ctx.textAlign = "right"
      ctx.fillText(badge, W - PAD - 20, y + rowH / 2 + 10)
      ctx.textAlign = "left"

      y += rowH
    }
  }

  // ── Footer ─────────────────────────────────────────────
  y = H - 72
  ctx.font      = "500 22px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.20)"
  ctx.textAlign = "center"
  ctx.fillText("musicana.vercel.app", W / 2, y)
  ctx.textAlign = "left"
}

/* ── Component ───────────────────────────────────────────── */
interface WrappedCardProps {
  onClose: () => void
}

export default function WrappedCard({ onClose }: WrappedCardProps) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const [rendering,  setRendering]  = useState(true)
  const [error,      setError]      = useState("")
  const [shareOk,    setShareOk]    = useState(false)
  const [downloading,setDownloading]= useState(false)

  const render = useCallback(async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setRendering(true)
    setError("")
    try {
      const top       = getAllTimeTopSongs(5)
      const heat      = getHeatmapData()
      const totalSecs = getAllTimeListenSeconds()
      const username  = getPartyUsername()
      await renderWrapped(canvas, top, heat, totalSecs, username)
    } catch (e: any) {
      setError(e?.message || "Render failed")
    } finally {
      setRendering(false)
    }
  }, [])

  useEffect(() => { render() }, [render])

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setDownloading(true)
    try {
      const url = canvas.toDataURL("image/png")
      const a   = document.createElement("a")
      a.href    = url
      a.download = `musicana-wrapped-${new Date().toISOString().slice(0, 10)}.png`
      a.click()
    } catch {}
    setTimeout(() => setDownloading(false), 800)
  }

  const share = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    try {
      canvas.toBlob(async (blob) => {
        if (!blob) return
        const file = new File([blob], "musicana-wrapped.png", { type: "image/png" })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: "My MUSICANA Wrapped 🎵" })
          setShareOk(true)
          setTimeout(() => setShareOk(false), 2000)
        } else {
          download()
        }
      }, "image/png")
    } catch {}
  }

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-bold text-base">Your Wrapped</span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={render}
            disabled={rendering}
            className="rounded-full gap-1.5 text-xs h-8"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${rendering ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Canvas preview — scrollable */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 pb-4 gap-4">
        <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl bg-[#0f0f1a] border border-white/8">
          {rendering && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f0f1a] z-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating your Wrapped…</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f0f1a] z-10 gap-3 px-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" onClick={render} className="rounded-full">Try again</Button>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full h-auto block"
            style={{ display: rendering ? "none" : "block" }}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex-shrink-0 px-4 pb-6 pt-2 flex gap-3 max-w-sm mx-auto w-full">
        <Button
          onClick={download}
          disabled={rendering || !!error}
          variant="outline"
          className="flex-1 rounded-2xl h-12 gap-2 border-white/20 bg-white/5 hover:bg-white/10"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Save
        </Button>
        <Button
          onClick={share}
          disabled={rendering || !!error}
          className="flex-1 rounded-2xl h-12 gap-2 bg-primary hover:bg-primary/90"
        >
          {shareOk
            ? "✓ Shared!"
            : <><Share2 className="w-4 h-4" />Share</>
          }
        </Button>
      </div>
    </div>
  )
}
