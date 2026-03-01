"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Download, Share2, X, Sparkles, RotateCcw, Loader2, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  getAllTimeTopSongs, getAllTimeListenSeconds,
  getHeatmapData, fmtListenTime,
  type TopSong, type HeatmapDay,
  getPartyUsername,
  getEarnedBadges, getTotalXP, getXPLevel,
  type BadgeStatus, type BadgeTier,
} from "@/lib/storage"

/* ── canvas helpers ────────────────────────────────────────── */
const W = 900
const H = 1600

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

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
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

function drawThumb(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null,
  x: number, y: number, s: number, r: number) {
  ctx.save()
  roundRect(ctx, x, y, s, s, r)
  ctx.clip()
  if (img) {
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

// Draw shared dark gradient background
function drawBackground(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, W * 0.5, H)
  bg.addColorStop(0,   "#0f0f1a")
  bg.addColorStop(0.4, "#12082a")
  bg.addColorStop(1,   "#0a0a14")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const glow1 = ctx.createRadialGradient(W * 0.15, H * 0.05, 0, W * 0.15, H * 0.05, W * 0.7)
  glow1.addColorStop(0,   "rgba(99,102,241,0.25)")
  glow1.addColorStop(0.5, "rgba(99,102,241,0.06)")
  glow1.addColorStop(1,   "transparent")
  ctx.fillStyle = glow1
  ctx.fillRect(0, 0, W, H)

  const glow2 = ctx.createRadialGradient(W * 0.9, H * 0.85, 0, W * 0.9, H * 0.85, W * 0.6)
  glow2.addColorStop(0,   "rgba(168,85,247,0.22)")
  glow2.addColorStop(1,   "transparent")
  ctx.fillStyle = glow2
  ctx.fillRect(0, 0, W, H)
}

function drawHeader(ctx: CanvasRenderingContext2D, username: string, subtitle: string): number {
  const PAD = 56
  let y = 64
  ctx.font = "bold 28px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.35)"
  ctx.letterSpacing = "4px"
  ctx.fillText("Musicanaz", PAD, y)
  ctx.letterSpacing = "0px"

  const now = new Date()
  ctx.font      = "600 22px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.22)"
  ctx.fillText(`${now.toLocaleString("en", { month: "long" })} ${now.getFullYear()}`, PAD, y + 38)

  const lineGrad = ctx.createLinearGradient(PAD, 0, PAD + 260, 0)
  lineGrad.addColorStop(0, "rgba(99,102,241,0.9)")
  lineGrad.addColorStop(1, "rgba(168,85,247,0.0)")
  ctx.fillStyle = lineGrad
  ctx.fillRect(PAD, y + 52, 260, 2)

  y += 100
  ctx.font      = "800 72px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.95)"
  const displayName = username && username !== "Guest" ? username : "Your"
  ctx.fillText(displayName, PAD, y)
  y += 12
  ctx.font = "700 52px system-ui, -apple-system, sans-serif"
  const titleGrad = ctx.createLinearGradient(PAD, y, PAD + 400, y + 60)
  titleGrad.addColorStop(0, "#818cf8")
  titleGrad.addColorStop(1, "#c084fc")
  ctx.fillStyle = titleGrad
  ctx.fillText(subtitle, PAD, y + 60)
  return y + 80
}

function drawFooter(ctx: CanvasRenderingContext2D) {
  ctx.font      = "500 22px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.20)"
  ctx.textAlign = "center"
  ctx.fillText("musicanaz.vercel.app", W / 2, H - 72)
  ctx.textAlign = "left"
}

/* ── Stats wrapped canvas ────────────────────────────────── */
async function renderStats(
  canvas: HTMLCanvasElement,
  top: TopSong[], heat: HeatmapDay[], totalSecs: number, username: string,
) {
  const ctx = canvas.getContext("2d")!
  canvas.width  = W
  canvas.height = H
  drawBackground(ctx)

  const PAD = 56
  let y = drawHeader(ctx, username, "2025 Wrapped")

  // Listen time card
  y += 20
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
  ctx.fillText(fmtListenTime(totalSecs) || "0s", PAD + 28, y + 122)
  const songsPlayed = top.reduce((a, b) => a + b.plays, 0)
  ctx.font      = "500 22px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.38)"
  ctx.fillText(`across ${songsPlayed} plays`, PAD + 28, y + 158)

  // Heatmap
  y += cardH + 48
  ctx.font      = "700 28px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.65)"
  ctx.fillText("Activity", PAD, y)
  ctx.font      = "500 21px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.28)"
  ctx.fillText("last 26 weeks", PAD + 114, y - 1)
  y += 20
  const CELL = 13, GAP = 3, COLS = 26, ROWS = 7
  const HEAT_COLORS = [
    "rgba(255,255,255,0.07)","rgba(99,102,241,0.25)","rgba(99,102,241,0.50)",
    "rgba(99,102,241,0.75)","rgba(99,102,241,1.00)",
  ]
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      const day = heat[col * 7 + row]
      ctx.fillStyle = day ? HEAT_COLORS[day.level] : HEAT_COLORS[0]
      roundRect(ctx, PAD + col * (CELL + GAP), y + row * (CELL + GAP), CELL, CELL, 3)
      ctx.fill()
    }
  }
  y += ROWS * (CELL + GAP) + 36

  // #1 song
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
    ctx.fillStyle = no1Grad; ctx.fill()
    roundRect(ctx, PAD, y, W - PAD * 2, no1H, 22)
    ctx.strokeStyle = "rgba(234,179,8,0.35)"; ctx.lineWidth = 1.5; ctx.stroke()
    let no1Img: HTMLImageElement | null = null
    try { no1Img = no1.song.thumbnail ? await loadImg(proxyThumb(no1.song.thumbnail)) : null } catch {}
    drawThumb(ctx, no1Img, PAD + 24, y + 30, 100, 14)
    ctx.font = "800 30px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "#facc15"; ctx.fillText("#1", PAD + 24, y + 26)
    const txtX = PAD + 24 + 100 + 20
    let t = no1.song.title
    ctx.font = "700 28px system-ui, -apple-system, sans-serif"
    while (t.length > 3 && ctx.measureText(t).width > W - PAD * 2 - 140) t = t.slice(0, -4) + "…"
    ctx.fillStyle = "rgba(255,255,255,0.95)"; ctx.fillText(t, txtX, y + 68)
    let ar = no1.song.artist
    ctx.font = "500 22px system-ui, -apple-system, sans-serif"
    while (ar.length > 3 && ctx.measureText(ar).width > W - PAD * 2 - 140) ar = ar.slice(0, -4) + "…"
    ctx.fillStyle = "rgba(255,255,255,0.50)"; ctx.fillText(ar, txtX, y + 98)
    ctx.font = "700 24px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "#facc15"; ctx.fillText(`${no1.plays} plays`, txtX, y + 135)
    y += no1H + 40
  }

  // Top 5
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
      roundRect(ctx, PAD, y, W - PAD * 2, rowH - 6, 18)
      ctx.fillStyle = i === 0 ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)"; ctx.fill()
      const ts = 58; let img: HTMLImageElement | null = null
      try { img = entry.song.thumbnail ? await loadImg(proxyThumb(entry.song.thumbnail, 100)) : null } catch {}
      drawThumb(ctx, img, PAD + 70, y + (rowH - 6 - ts) / 2, ts, 10)
      ctx.font = `800 ${i < 3 ? 32 : 26}px system-ui, -apple-system, sans-serif`
      ctx.fillStyle = RANK_COLORS[i]; ctx.textAlign = "center"
      ctx.fillText(`${i + 1}`, PAD + 36, y + rowH / 2 + 10); ctx.textAlign = "left"
      const infoX = PAD + 70 + ts + 20; const maxW = W - PAD - infoX - 110
      ctx.font = "600 24px system-ui, -apple-system, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.92)"
      let title = entry.song.title
      while (title.length > 3 && ctx.measureText(title).width > maxW) title = title.slice(0, -4) + "…"
      ctx.fillText(title, infoX, y + rowH / 2 - 4)
      ctx.font = "500 20px system-ui, -apple-system, sans-serif"; ctx.fillStyle = "rgba(255,255,255,0.40)"
      let artist = entry.song.artist
      while (artist.length > 3 && ctx.measureText(artist).width > maxW) artist = artist.slice(0, -4) + "…"
      ctx.fillText(artist, infoX, y + rowH / 2 + 26)
      ctx.font = "700 22px system-ui, -apple-system, sans-serif"
      ctx.fillStyle = "rgba(129,140,248,0.90)"; ctx.textAlign = "right"
      ctx.fillText(`${entry.plays}×`, W - PAD - 20, y + rowH / 2 + 10); ctx.textAlign = "left"
      y += rowH
    }
  }
  drawFooter(ctx)
}

/* ── Achievement wrapped canvas ─────────────────────────── */
const TIER_CANVAS: Record<BadgeTier, { card: string; border: string; text: string; dot: string }> = {
  normal:   { card: "rgba(59,130,246,0.15)",  border: "rgba(59,130,246,0.35)",  text: "#60a5fa", dot: "#3b82f6" },
  uncommon: { card: "rgba(34,197,94,0.15)",   border: "rgba(34,197,94,0.35)",   text: "#4ade80", dot: "#22c55e" },
  epic:     { card: "rgba(168,85,247,0.15)",  border: "rgba(168,85,247,0.35)",  text: "#c084fc", dot: "#a855f7" },
  rare:     { card: "rgba(245,158,11,0.20)",  border: "rgba(245,158,11,0.40)",  text: "#fbbf24", dot: "#f59e0b" },
}

async function renderAchievements(
  canvas: HTMLCanvasElement,
  earned: BadgeStatus[], xp: number, username: string,
) {
  const ctx = canvas.getContext("2d")!
  canvas.width  = W
  canvas.height = H
  drawBackground(ctx)

  const PAD = 56
  let y = drawHeader(ctx, username, "Achievements")

  // XP level card
  y += 20
  const level = getXPLevel(xp)
  const levelStarts = [0, 100, 300, 600, 1000, 1500, 2500, 4000]
  const levelStart  = levelStarts[level.level - 1] ?? 0
  const pct = level.nextAt === Infinity ? 1
    : Math.min(1, (xp - levelStart) / (level.nextAt - levelStart))

  roundRect(ctx, PAD, y, W - PAD * 2, 130, 22)
  const lvlGrad = ctx.createLinearGradient(PAD, y, W - PAD, y + 130)
  lvlGrad.addColorStop(0, "rgba(99,102,241,0.22)")
  lvlGrad.addColorStop(1, "rgba(168,85,247,0.14)")
  ctx.fillStyle = lvlGrad; ctx.fill()
  roundRect(ctx, PAD, y, W - PAD * 2, 130, 22)
  ctx.strokeStyle = "rgba(99,102,241,0.40)"; ctx.lineWidth = 1.5; ctx.stroke()

  // Level circle
  const cx2 = PAD + 60, cy2 = y + 65
  ctx.beginPath(); ctx.arc(cx2, cy2, 42, 0, Math.PI * 2)
  const circGrad = ctx.createRadialGradient(cx2 - 10, cy2 - 10, 0, cx2, cy2, 42)
  circGrad.addColorStop(0, "rgba(129,140,248,0.9)")
  circGrad.addColorStop(1, "rgba(168,85,247,0.7)")
  ctx.fillStyle = circGrad; ctx.fill()
  ctx.font = "900 36px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "#fff"; ctx.textAlign = "center"
  ctx.fillText(`${level.level}`, cx2, cy2 + 13); ctx.textAlign = "left"

  ctx.font      = "700 32px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.90)"
  ctx.fillText(level.title, PAD + 118, y + 52)
  ctx.font      = "500 22px system-ui, -apple-system, sans-serif"
  ctx.fillStyle = "rgba(255,255,255,0.40)"
  ctx.fillText(`${xp.toLocaleString()} XP  ·  ${earned.length} badge${earned.length !== 1 ? "s" : ""} earned`, PAD + 118, y + 84)

  // XP progress bar
  const bx = PAD + 118, bw = W - PAD - PAD - 118 - 20, bh = 10, by = y + 104
  roundRect(ctx, bx, by, bw, bh, 5)
  ctx.fillStyle = "rgba(255,255,255,0.10)"; ctx.fill()
  if (pct > 0) {
    roundRect(ctx, bx, by, Math.max(bw * pct, 16), bh, 5)
    const barGrad = ctx.createLinearGradient(bx, 0, bx + bw, 0)
    barGrad.addColorStop(0, "#818cf8"); barGrad.addColorStop(1, "#c084fc")
    ctx.fillStyle = barGrad; ctx.fill()
  }
  y += 162

  // Earned badges grid (3 per row)
  if (earned.length === 0) {
    ctx.font      = "600 30px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.35)"
    ctx.textAlign = "center"
    ctx.fillText("No badges earned yet — keep listening!", W / 2, y + 80)
    ctx.textAlign = "left"
  } else {
    ctx.font      = "700 28px system-ui, -apple-system, sans-serif"
    ctx.fillStyle = "rgba(255,255,255,0.65)"
    ctx.fillText(`🏅  Earned Badges (${earned.length})`, PAD, y)
    y += 28

    const COLS    = 3
    const cellW   = (W - PAD * 2 - (COLS - 1) * 16) / COLS
    const cellH   = 160
    const maxRows = Math.floor((H - y - 100) / (cellH + 16))
    const show    = earned.slice(0, COLS * maxRows)

    for (let i = 0; i < show.length; i++) {
      const badge = show[i]
      const col   = i % COLS
      const row   = Math.floor(i / COLS)
      const bx    = PAD + col * (cellW + 16)
      const by    = y + row * (cellH + 16)

      const ts = TIER_CANVAS[badge.tier]

      // Card bg
      roundRect(ctx, bx, by, cellW, cellH, 18)
      ctx.fillStyle = ts.card; ctx.fill()
      roundRect(ctx, bx, by, cellW, cellH, 18)
      ctx.strokeStyle = ts.border; ctx.lineWidth = 1.2; ctx.stroke()

      // Shine overlay
      roundRect(ctx, bx, by, cellW, cellH / 2, 18)
      ctx.fillStyle = "rgba(255,255,255,0.04)"; ctx.fill()

      // Emoji
      ctx.font = "52px system-ui, -apple-system, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(badge.emoji, bx + cellW / 2, by + 68)

      // Name
      ctx.font      = "700 20px system-ui, -apple-system, sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.90)"
      let name = badge.name
      while (name.length > 3 && ctx.measureText(name).width > cellW - 16) name = name.slice(0, -4) + "…"
      ctx.fillText(name, bx + cellW / 2, by + 100)

      // Tier chip
      ctx.font      = "600 14px system-ui, -apple-system, sans-serif"
      ctx.fillStyle = ts.text
      const tierLabel = badge.tier.charAt(0).toUpperCase() + badge.tier.slice(1)
      ctx.fillText(tierLabel, bx + cellW / 2, by + 124)

      // XP
      ctx.font      = "700 16px system-ui, -apple-system, sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.35)"
      ctx.fillText(`+${badge.xp} XP`, bx + cellW / 2, by + 148)

      ctx.textAlign = "left"

      // Tier dot (top right)
      ctx.beginPath(); ctx.arc(bx + cellW - 16, by + 16, 6, 0, Math.PI * 2)
      ctx.fillStyle = ts.dot; ctx.fill()
    }

    if (earned.length > show.length) {
      const hiddenRow = Math.floor(show.length / COLS)
      const moreY = y + hiddenRow * (cellH + 16) + cellH / 2
      ctx.font      = "600 26px system-ui, -apple-system, sans-serif"
      ctx.fillStyle = "rgba(255,255,255,0.30)"
      ctx.textAlign = "center"
      ctx.fillText(`+${earned.length - show.length} more badges`, W / 2, moreY)
      ctx.textAlign = "left"
    }
  }

  drawFooter(ctx)
}

/* ── Component ───────────────────────────────────────────── */
interface WrappedCardProps { onClose: () => void }

type Mode = "stats" | "achievements"

export default function WrappedCard({ onClose }: WrappedCardProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const [mode,        setMode]        = useState<Mode>("stats")
  const [rendering,   setRendering]   = useState(true)
  const [error,       setError]       = useState("")
  const [shareOk,     setShareOk]     = useState(false)
  const [downloading, setDownloading] = useState(false)

  const render = useCallback(async (m: Mode = mode) => {
    const canvas = canvasRef.current
    if (!canvas) return
    setRendering(true)
    setError("")
    try {
      const username = getPartyUsername()
      if (m === "stats") {
        const top       = getAllTimeTopSongs(5)
        const heat      = getHeatmapData()
        const totalSecs = getAllTimeListenSeconds()
        await renderStats(canvas, top, heat, totalSecs, username)
      } else {
        const earned = getEarnedBadges()
        const xp     = getTotalXP()
        await renderAchievements(canvas, earned, xp, username)
      }
    } catch (e: any) {
      setError(e?.message || "Render failed")
    } finally {
      setRendering(false)
    }
  }, [mode])

  useEffect(() => { render(mode) }, [mode]) // eslint-disable-line

  const switchMode = (m: Mode) => {
    if (m === mode) return
    setMode(m)
  }

  const download = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setDownloading(true)
    try {
      const a    = document.createElement("a")
      a.href     = canvas.toDataURL("image/png")
      a.download = `musicanaz-${mode}-${new Date().toISOString().slice(0, 10)}.png`
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
        const file = new File([blob], `musicanaz-${mode}.png`, { type: "image/png" })
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: mode === "stats" ? "My Musicanaz Wrapped 🎵" : "My Musicanaz Achievements 🏅" })
          setShareOk(true)
          setTimeout(() => setShareOk(false), 2000)
        } else { download() }
      }, "image/png")
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-sm">

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {mode === "stats"
            ? <Sparkles className="w-5 h-5 text-primary" />
            : <Shield   className="w-5 h-5 text-amber-400" />
          }
          <span className="font-bold text-base">
            {mode === "stats" ? "Your Wrapped" : "Your Achievements"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => render(mode)} disabled={rendering}
            className="rounded-full gap-1.5 text-xs h-8">
            <RotateCcw className={`w-3.5 h-3.5 ${rendering ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Mode switcher */}
      <div className="flex gap-1 mx-4 mb-3 bg-white/8 rounded-2xl p-1 flex-shrink-0">
        <button
          onClick={() => switchMode("stats")}
          className={["flex-1 py-2 rounded-xl text-xs font-semibold transition-all gap-1.5 flex items-center justify-center",
            mode === "stats"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <Sparkles className="w-3.5 h-3.5" />
          Stats Wrapped
        </button>
        <button
          onClick={() => switchMode("achievements")}
          className={["flex-1 py-2 rounded-xl text-xs font-semibold transition-all gap-1.5 flex items-center justify-center",
            mode === "achievements"
              ? "bg-amber-500 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          ].join(" ")}
        >
          <Shield className="w-3.5 h-3.5" />
          Achievements
        </button>
      </div>

      {/* Canvas preview */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center px-4 pb-4 gap-4">
        <div className="relative w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl bg-[#0f0f1a] border border-white/8">
          {rendering && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f0f1a] z-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Generating your card…</p>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0f0f1a] z-10 gap-3 px-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button size="sm" onClick={() => render(mode)} className="rounded-full">Try again</Button>
            </div>
          )}
          <canvas ref={canvasRef} className="w-full h-auto block" style={{ display: rendering ? "none" : "block" }} />
        </div>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 px-4 pb-6 pt-2 flex gap-3 max-w-sm mx-auto w-full">
        <Button onClick={download} disabled={rendering || !!error} variant="outline"
          className="flex-1 rounded-2xl h-12 gap-2 border-white/20 bg-white/5 hover:bg-white/10">
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          Save
        </Button>
        <Button onClick={share} disabled={rendering || !!error}
          className="flex-1 rounded-2xl h-12 gap-2 bg-primary hover:bg-primary/90">
          {shareOk ? "✓ Shared!" : <><Share2 className="w-4 h-4" />Share</>}
        </Button>
      </div>
    </div>
  )
}
