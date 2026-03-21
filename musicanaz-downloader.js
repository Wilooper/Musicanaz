#!/usr/bin/env node
/**
 * Musicanaz Download Server
 * ==========================
 * Zero npm dependencies — only Node.js (>=16) and yt-dlp required.
 *
 * SETUP
 * -----
 * 1. Install yt-dlp:
 *    Windows:  winget install yt-dlp  or  choco install yt-dlp
 *    macOS:    brew install yt-dlp
 *    Linux:    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp
 *    Termux:   pkg install yt-dlp
 *
 * 2. Run this server:
 *    node musicanaz-downloader.js
 *
 * 3. Expose it to the internet (pick one):
 *    Cloudflare Tunnel (free, recommended):
 *      cloudflared tunnel --url http://localhost:7891
 *    ngrok (free tier):
 *      ngrok http 7891
 *    Or just use your VPS public IP:
 *      http://YOUR_IP:7891
 *
 * 4. Paste the public URL into Musicanaz → Settings → Download Server
 *
 * ENDPOINTS
 * ---------
 * GET /health          → { ok: true, ytdlp: true/false, version: "..." }
 * GET /download?videoId=XXX&title=YYY&artist=ZZZ
 *                      → streams audio file with Content-Disposition
 *
 * ENV VARS
 * --------
 * PORT=7891            Server port (default 7891)
 * YTDLP_PATH=yt-dlp   Full path to yt-dlp binary if not on PATH
 * ALLOWED_ORIGIN=*     CORS origin (default * — restrict if you want)
 */

"use strict"

const http     = require("http")
const https    = require("https")
const { spawn, execFile } = require("child_process")
const { URL }  = require("url")
const path     = require("path")

const PORT         = parseInt(process.env.PORT  || "7891", 10)
const YTDLP        = process.env.YTDLP_PATH || "yt-dlp"
const ALLOWED_ORIG = process.env.ALLOWED_ORIGIN || "*"

// ── helpers ───────────────────────────────────────────────────────────────────

function safeFilename(s) {
  return String(s || "").replace(/[/\\?%*:|"<>]/g, "").trim().slice(0, 80) || "track"
}

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin":  ALLOWED_ORIG === "*" ? (origin || "*") : ALLOWED_ORIG,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range",
    "Access-Control-Max-Age":       "86400",
  }
}

function json(res, status, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(status, {
    "Content-Type":   "application/json",
    "Content-Length": Buffer.byteLength(body),
    ...corsHeaders(),
  })
  res.end(body)
}

// Check yt-dlp once at startup, cache result
let ytdlpOk      = false
let ytdlpVersion = "unknown"

function checkYtdlp() {
  return new Promise(resolve => {
    execFile(YTDLP, ["--version"], { timeout: 5000 }, (err, stdout) => {
      if (err) { resolve(false); return }
      ytdlpVersion = (stdout || "").trim()
      ytdlpOk = true
      resolve(true)
    })
  })
}

// ── /health ──────────────────────────────────────────────────────────────────
function handleHealth(req, res) {
  res.writeHead(200, {
    "Content-Type": "application/json",
    ...corsHeaders(req.headers.origin),
  })
  res.end(JSON.stringify({
    ok:      true,
    ytdlp:   ytdlpOk,
    version: ytdlpVersion,
    server:  "Musicanaz Download Server",
  }))
}

// ── /download ────────────────────────────────────────────────────────────────
// Strategy:
//   1. Run yt-dlp --get-url to extract the direct CDN audio URL (fast, <2s)
//   2. Pipe that URL through Node's https.get to the client response
//   This avoids buffering the whole file in memory and doesn't need ffmpeg.
function handleDownload(req, res, params) {
  const videoId = params.get("videoId")
  const title   = params.get("title")   || "Unknown"
  const artist  = params.get("artist")  || "Unknown"

  if (!videoId) {
    return json(res, 400, { error: "Missing videoId" })
  }
  if (!ytdlpOk) {
    return json(res, 503, { error: "yt-dlp not found. Please install yt-dlp on the server." })
  }

  const ytUrl    = `https://www.youtube.com/watch?v=${videoId}`
  // Best audio-only: prefer webm/opus for quality, m4a as fallback
  const fmtSel  = "bestaudio[ext=webm]/bestaudio[ext=m4a]/bestaudio"

  console.log(`[download] ${artist} - ${title}  (${videoId})`)

  // Step 1: get direct CDN URL from yt-dlp
  const getUrl = spawn(YTDLP, [
    ytUrl,
    "-f", fmtSel,
    "--get-url",
    "--no-playlist",
    "--no-warnings",
    "--quiet",
  ], { timeout: 20_000 })

  let rawUrl = ""
  let errOut = ""

  getUrl.stdout.on("data", d => { rawUrl += d.toString() })
  getUrl.stderr.on("data", d => { errOut += d.toString() })

  getUrl.on("close", code => {
    rawUrl = rawUrl.trim().split("\n")[0].trim()

    if (code !== 0 || !rawUrl) {
      console.error("[yt-dlp error]", errOut)
      return json(res, 502, {
        error: "yt-dlp could not resolve a stream URL. Video may be unavailable or age-restricted.",
        detail: errOut.slice(0, 300),
      })
    }

    // Step 2: Detect format from URL or content-type
    const isM4a  = rawUrl.includes("mime=audio%2Fmp4") || rawUrl.includes("mime=audio/mp4")
    const isOgg  = rawUrl.includes("mime=audio%2Fogg") || rawUrl.includes("mime=audio/ogg")
    const ext    = isM4a ? "m4a" : isOgg ? "ogg" : "webm"
    const mime   = isM4a ? "audio/mp4" : isOgg ? "audio/ogg" : "audio/webm"
    const fname  = `${safeFilename(artist)} - ${safeFilename(title)}.${ext}`

    // Step 3: Proxy the CDN audio to the client
    const parsed   = new URL(rawUrl)
    const protocol = parsed.protocol === "https:" ? https : http
    const options  = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      headers: {
        "User-Agent":      "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
        "Referer":         "https://www.youtube.com/",
        "Origin":          "https://www.youtube.com",
        "Accept-Encoding": "identity",
        ...(req.headers.range ? { "Range": req.headers.range } : {}),
      },
    }

    const upstream = protocol.get(options, upRes => {
      const status = upRes.statusCode || 200
      const cl     = upRes.headers["content-length"] || ""
      const ct     = upRes.headers["content-type"]   || mime

      const resHeaders = {
        "Content-Type":           ct,
        "Content-Disposition":    `attachment; filename*=UTF-8''${encodeURIComponent(fname)}`,
        "Cache-Control":          "no-store",
        "X-Content-Type-Options": "nosniff",
        ...corsHeaders(req.headers.origin),
      }
      if (cl)                           resHeaders["Content-Length"] = cl
      if (upRes.headers["accept-ranges"]) resHeaders["Accept-Ranges"] = "bytes"
      if (upRes.headers["content-range"]) resHeaders["Content-Range"] = upRes.headers["content-range"]

      res.writeHead(status, resHeaders)
      upRes.pipe(res)
      upRes.on("error", err => {
        console.error("[proxy error]", err.message)
        if (!res.writableEnded) res.end()
      })
    })

    upstream.on("error", err => {
      console.error("[upstream error]", err.message)
      if (!res.headersSent) return json(res, 502, { error: "Failed to fetch audio from CDN" })
      if (!res.writableEnded) res.end()
    })

    req.on("close", () => upstream.destroy())
  })

  getUrl.on("error", err => {
    console.error("[spawn error]", err.message)
    json(res, 503, { error: "Could not run yt-dlp: " + err.message })
  })
}

// ── Router ────────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, corsHeaders(req.headers.origin))
    res.end()
    return
  }

  const url    = new URL(req.url, `http://localhost:${PORT}`)
  const route  = url.pathname.replace(/\/+$/, "") || "/"
  const params = url.searchParams

  if (route === "/health")   return handleHealth(req, res)
  if (route === "/download") return handleDownload(req, res, params)

  json(res, 404, { error: "Not found", routes: ["/health", "/download"] })
})

// ── Startup ───────────────────────────────────────────────────────────────────
checkYtdlp().then(ok => {
  if (ok) {
    console.log(`✅  yt-dlp found  (${ytdlpVersion})`)
  } else {
    console.warn("⚠️   yt-dlp not found on PATH. Install it before using /download.")
    console.warn(`    Binary path tried: ${YTDLP}`)
    console.warn("    Set YTDLP_PATH env var to override.")
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🎵  Musicanaz Download Server`)
    console.log(`    Listening on  http://0.0.0.0:${PORT}`)
    console.log(`    Health check  http://localhost:${PORT}/health`)
    console.log(`\n    To expose publicly:`)
    console.log(`      Cloudflare Tunnel:  cloudflared tunnel --url http://localhost:${PORT}`)
    console.log(`      ngrok:              ngrok http ${PORT}`)
    console.log(`\n    Then paste the public URL into Musicanaz → Settings → Download Server\n`)
  })
})

server.on("error", err => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌  Port ${PORT} is already in use. Set PORT=XXXX to use a different port.\n`)
  } else {
    console.error("Server error:", err)
  }
  process.exit(1)
})
