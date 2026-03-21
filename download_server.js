#!/usr/bin/env node
/**
 * Musicanaz Downloader — Node.js
 * ================================
 * Implements the MUSIVA v7 download API so Musicanaz can download songs
 * through your own machine instead of the remote server.
 *
 * ENDPOINTS
 * ---------
 * GET  /health                       — health check (Settings uses this)
 * GET  /download/health              — health check (alias)
 * POST /download/start               — { video_id } → { uid }
 * GET  /download/status/:uid         — { status, progress, title, artist }
 * GET  /download/file/:uid           — streams the finished MP3
 * POST /download/done/:uid           — cleanup temp files
 *
 * SETUP
 * -----
 * 1. Install yt-dlp:
 *    Windows:  winget install yt-dlp   OR   choco install yt-dlp
 *    macOS:    brew install yt-dlp
 *    Linux:    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
 *                -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp
 *    Termux:   pkg install yt-dlp
 *
 * 2. Run this server:
 *    node musicanaz-downloader.js
 *
 * 3. Expose publicly (pick one):
 *    Cloudflare Tunnel (free, recommended):
 *      cloudflared tunnel --url http://localhost:7891
 *    ngrok:
 *      ngrok http 7891
 *    Or use your machine's local IP for LAN use:
 *      http://192.168.x.x:7891
 *
 * 4. In Musicanaz → Settings → Download Server, paste the public URL
 *    and tap "Test & Save". OR set the env var:
 *      DOWNLOAD_SERVER_URL=https://your-tunnel-url.trycloudflare.com
 *
 * ENV VARS
 * --------
 * PORT=7891            Server port (default 7891)
 * YTDLP_PATH=yt-dlp   Full path to yt-dlp binary if not on PATH
 * AUDIO_FORMAT=bestaudio  yt-dlp format selector (default: best available audio)
 * ALLOWED_ORIGIN=*    CORS origin (default * — restrict if hosting publicly)
 *
 * REQUIREMENTS
 * ------------
 * Node.js >= 16  (no npm packages needed)
 * yt-dlp         (must be installed separately, see above)
 * ffmpeg         (optional — only needed if you want MP3 conversion)
 */

"use strict"

const http    = require("http")
const https   = require("https")
const { execFile, spawn } = require("child_process")
const { URL } = require("url")
const fs      = require("fs")
const path    = require("path")
const os      = require("os")
const crypto  = require("crypto")

const PORT    = parseInt(process.env.PORT || "7891", 10)
const YTDLP   = process.env.YTDLP_PATH || "yt-dlp"
// Always extract to mp3 for maximum player compatibility.
// Users can override with AUDIO_FORMAT and AUDIO_CODEC env vars.
const FORMAT     = process.env.AUDIO_FORMAT || "bestaudio/best"
const AUDIO_CODEC = process.env.AUDIO_CODEC || "mp3"
const ORIGIN  = process.env.ALLOWED_ORIGIN || "*"

// Session store: uid → { status, progress, title, artist, filePath, error, createdAt }
const sessions = new Map()

// Clean up sessions older than 1 hour
setInterval(() => {
  const cutoff = Date.now() - 3_600_000
  for (const [uid, s] of sessions) {
    if (s.createdAt < cutoff) {
      if (s.filePath) { try { fs.unlinkSync(s.filePath) } catch {} }
      sessions.delete(uid)
    }
  }
}, 60_000)

// ── helpers ───────────────────────────────────────────────────────────────────

function uid() {
  return crypto.randomBytes(12).toString("hex")
}

function safe(s) {
  return String(s || "").replace(/[/\\?%*:|"<>]/g, "").trim().slice(0, 80) || "track"
}

function cors(origin) {
  return {
    "Access-Control-Allow-Origin":  ORIGIN === "*" ? (origin || "*") : ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age":       "86400",
  }
}

function json(res, status, obj, origin) {
  const body = JSON.stringify(obj)
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), ...cors(origin) })
  res.end(body)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ""
    req.on("data", chunk => { data += chunk })
    req.on("end", () => {
      try { resolve(JSON.parse(data || "{}")) }
      catch { resolve({}) }
    })
    req.on("error", reject)
  })
}

// ── yt-dlp check ─────────────────────────────────────────────────────────────

let ytdlpOk      = false
let ytdlpVersion = "unknown"

function checkYtdlp() {
  return new Promise(resolve => {
    execFile(YTDLP, ["--version"], { timeout: 8000 }, (err, stdout) => {
      if (err) { resolve(false); return }
      ytdlpVersion = (stdout || "").trim()
      ytdlpOk = true
      resolve(true)
    })
  })
}


// ── ffmpeg metadata embed (pure audio output) ────────────────────────────────
// Embeds title, artist, album and cover art WITHOUT creating a video stream.
// The old version used -map 1:v which made players think the file was a video.
// Fix: use -disposition:v:0 attached_pic so cover art is metadata, not video.
function embedMetadata(filePath, title, artist, album, thumbnailUrl, ext) {
  return new Promise((resolve) => {
    const { execFile: ef } = require("child_process")
    const pathMod = require("path")
    const osMod   = require("os")
    const fs      = require("fs")

    ef("ffmpeg", ["-version"], { timeout: 5000 }, (err) => {
      if (err) { resolve(false); return }  // ffmpeg not installed — skip silently

      const out = filePath + ".out." + ext

      const doEmbed = (thumbPath) => {
        const cmd = ["ffmpeg", "-y", "-i", filePath]
        if (thumbPath) cmd.push("-i", thumbPath)

        // Common: wipe existing tags, set new ones
        cmd.push(
          "-map", "0:a",
          "-map_metadata", "-1",
          "-metadata", `title=${title || ""}`,
          "-metadata", `artist=${artist || ""}`,
          "-metadata", `album=${album || title || ""}`,
          "-metadata", `comment=Musicanaz`,
        )

        if (ext === "mp3") {
          cmd.push("-codec:a", "copy", "-id3v2_version", "3")
          if (thumbPath) {
            // APIC frame = ID3 attached picture. This is METADATA, not a video stream.
            // Players show it as artwork; they do NOT treat the file as a video.
            cmd.push(
              "-map", "1:0",
              "-codec:v:0", "mjpeg",
              "-disposition:v:0", "attached_pic",
              "-metadata:s:v", "comment=Cover (front)",
            )
          }
        } else if (ext === "m4a" || ext === "mp4") {
          cmd.push("-codec:a", "copy")
          if (thumbPath) {
            cmd.push(
              "-map", "1:0",
              "-codec:v:0", "mjpeg",
              "-disposition:v:0", "attached_pic",
            )
          }
        } else {
          // ogg / webm / opus — audio only, -vn strips any accidental video stream
          cmd.push("-vn", "-codec:a", "copy")
        }

        cmd.push(out)

        const [ffmpegBin, ...ffArgs] = cmd
        ef(ffmpegBin, ffArgs, { timeout: 90_000 }, (err2) => {
          if (thumbPath) { try { fs.unlinkSync(thumbPath) } catch {} }
          if (err2 || !fs.existsSync(out)) {
            try { fs.unlinkSync(out) } catch {}
            resolve(false)
            return
          }
          try { fs.renameSync(out, filePath) } catch {}
          resolve(true)
        })
      }

      // Download thumbnail — include Referer for YouTube CDN images
      const coverExts = ["mp3", "m4a", "mp4"]
      if (thumbnailUrl && coverExts.includes(ext)) {
        const tmp      = pathMod.join(osMod.tmpdir(), `mz_thumb_${Date.now()}.jpg`)
        const protocol = thumbnailUrl.startsWith("https") ? https : http
        const opts     = {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Musicanaz/1.0)",
            "Referer":    "https://www.youtube.com/",
          },
        }
        const reqThumb = protocol.get(thumbnailUrl, opts, (res) => {
          if (res.statusCode !== 200) { res.resume(); doEmbed(null); return }
          const stream = fs.createWriteStream(tmp)
          res.pipe(stream)
          stream.on("finish", () => doEmbed(tmp))
          stream.on("error",  () => { try { fs.unlinkSync(tmp) } catch {} doEmbed(null) })
        })
        reqThumb.on("error",  () => doEmbed(null))
        reqThumb.setTimeout(10_000, () => { reqThumb.destroy(); doEmbed(null) })
      } else {
        doEmbed(null)
      }
    })
  })
}

// ── download session ──────────────────────────────────────────────────────────

function startDownload(id, videoId, title, artist, album, thumbnailUrl) {
  const ytUrl   = `https://www.youtube.com/watch?v=${videoId}`
  const tmpDir  = os.tmpdir()
  const outBase = path.join(tmpDir, `musicanaz_${id}`)

  sessions.set(id, {
    status:    "fetching_meta",
    progress:  0,
    title:     title || "",
    artist:    artist || "",
    filePath:  null,
    error:     null,
    createdAt: Date.now(),
  })

  // Use yt-dlp output template so we get the actual filename back
  // --extract-audio: strip video streams, output pure audio file
  // --audio-format mp3: universal compatibility across all players
  // --audio-quality 0: best quality
  const args = [
    ytUrl,
    "-f", FORMAT,
    "-o", `${outBase}.%(ext)s`,
    "--extract-audio",
    "--audio-format", AUDIO_CODEC,
    "--audio-quality", "0",
    "--no-playlist",
    "--no-warnings",
    "--newline",
    "--progress",
  ]

  const proc = spawn(YTDLP, args)
  let   ext  = "webm"

  proc.stdout.on("data", chunk => {
    const line = chunk.toString()

    // Detect progress lines like: [download]  45.2% of   5.23MiB
    const m = line.match(/\[download\]\s+([\d.]+)%/)
    if (m) {
      const pct = parseFloat(m[1])
      const s   = sessions.get(id)
      if (s) {
        s.status   = pct < 100 ? "downloading" : "processing"
        s.progress = Math.round(pct)
      }
    }

    // Detect destination line to capture extension
    const dest = line.match(/\[download\] Destination: (.+)/)
    if (dest) {
      ext = path.extname(dest[1]).slice(1) || "webm"
    }
  })

  proc.stderr.on("data", chunk => {
    const line = chunk.toString()
    // Detect [ExtractAudio] or similar
    const dest = line.match(/Destination: (.+)/)
    if (dest) ext = path.extname(dest[1]).slice(1) || ext
  })

  proc.on("close", code => {
    const s = sessions.get(id)
    if (!s) return

    if (code !== 0) {
      s.status = "error"
      s.error  = "yt-dlp exited with code " + code
      return
    }

    // Find the output file (glob outBase.*)
    let found = null
    try {
      const files = fs.readdirSync(tmpDir)
      for (const f of files) {
        if (f.startsWith(`musicanaz_${id}.`)) {
          found = path.join(tmpDir, f)
          ext   = path.extname(f).slice(1)
          break
        }
      }
    } catch {}

    if (!found) {
      s.status = "error"
      s.error  = "Output file not found"
      return
    }

    s.status   = "embedding"
    s.progress = 95
    s.filePath = found
    s.ext      = ext

    // Embed metadata (best-effort — skipped if ffmpeg not installed)
    embedMetadata(found, title, artist, album, thumbnailUrl, ext).then(() => {
      const s2 = sessions.get(id)
      if (s2) { s2.status = "ready"; s2.progress = 100 }
    })
  })

  proc.on("error", err => {
    const s = sessions.get(id)
    if (s) { s.status = "error"; s.error = err.message }
  })
}

// ── route handlers ────────────────────────────────────────────────────────────

function handleHealth(req, res) {
  res.writeHead(200, { "Content-Type": "application/json", ...cors(req.headers.origin) })
  res.end(JSON.stringify({
    ok:       true,
    ytdlp:    ytdlpOk,
    version:  ytdlpVersion,
    server:   "Musicanaz Downloader (Node.js)",
    sessions: sessions.size,
  }))
}

async function handleStart(req, res) {
  const body     = await readBody(req)
  const videoId  = body.video_id
  const title    = body.title   || ""
  const artist   = body.artist  || ""

  if (!videoId)  return json(res, 400, { error: "Missing video_id" }, req.headers.origin)
  if (!ytdlpOk)  return json(res, 503, { error: "yt-dlp not found. Install yt-dlp on this machine." }, req.headers.origin)

  const album        = body.album        || ""
  const thumbnailUrl = body.thumbnail    || ""
  const id = uid()
  startDownload(id, videoId, title, artist, album, thumbnailUrl)

  json(res, 200, {
    uid:        id,
    status_url: `/download/status/${id}`,
    file_url:   `/download/file/${id}`,
  }, req.headers.origin)
}

function handleStatus(req, res, id) {
  const s = sessions.get(id)
  if (!s) return json(res, 404, { error: "Session not found" }, req.headers.origin)
  json(res, 200, {
    uid:      id,
    status:   s.status,
    progress: s.progress,
    title:    s.title,
    artist:   s.artist,
    detail:   s.error || undefined,
  }, req.headers.origin)
}

function handleFile(req, res, id) {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const s   = sessions.get(id)

  if (!s)              return json(res, 404, { error: "Session not found" }, req.headers.origin)
  if (s.status === "error") return json(res, 500, { error: s.error || "Download failed" }, req.headers.origin)
  if (s.status !== "ready")  return json(res, 409, { error: `Not ready yet (${s.status})` }, req.headers.origin)
  if (!s.filePath || !fs.existsSync(s.filePath))
    return json(res, 410, { error: "File no longer available" }, req.headers.origin)

  const ext      = s.ext || path.extname(s.filePath).slice(1) || "webm"
  const mime     = ext === "mp3" ? "audio/mpeg" : ext === "m4a" ? "audio/mp4" : ext === "ogg" ? "audio/ogg" : "audio/webm"
  const safeName = `${safe(s.artist)} - ${safe(s.title)}.${ext}`
  const filename = url.searchParams.get("filename") || safeName

  const stat = fs.statSync(s.filePath)
  res.writeHead(200, {
    "Content-Type":           mime,
    "Content-Length":         String(stat.size),
    "Content-Disposition":    `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    "Cache-Control":          "no-store",
    "X-Content-Type-Options": "nosniff",
    ...cors(req.headers.origin),
  })

  const stream = fs.createReadStream(s.filePath)
  stream.pipe(res)
  stream.on("error", () => { if (!res.writableEnded) res.end() })
  req.on("close", () => stream.destroy())
}

function handleDone(req, res, id) {
  const s = sessions.get(id)
  if (s?.filePath) { try { fs.unlinkSync(s.filePath) } catch {} }
  sessions.delete(id)
  json(res, 200, { ok: true }, req.headers.origin)
}

// ── router ────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, cors(req.headers.origin))
    res.end()
    return
  }

  const url  = new URL(req.url, `http://localhost:${PORT}`)
  const path_ = url.pathname.replace(/\/+$/, "")
  const m    = path_.match(/^\/download\/(status|file|done)\/([a-f0-9]+)$/)

  if ((path_ === "/health" || path_ === "/download/health") && req.method === "GET") return handleHealth(req, res)
  if (path_ === "/download/start"  && req.method === "POST") return handleStart(req, res)
  if (m && m[1] === "status" && req.method === "GET")  return handleStatus(req, res, m[2])
  if (m && m[1] === "file"   && req.method === "GET")  return handleFile(req, res, m[2])
  if (m && m[1] === "done"   && req.method === "POST") return handleDone(req, res, m[2])

  json(res, 404, { error: "Not found", routes: ["/health", "/health", "/download/health", "/download/start", "/download/status/:uid", "/download/file/:uid", "/download/done/:uid"] }, req.headers.origin)
})

// ── startup ───────────────────────────────────────────────────────────────────

checkYtdlp().then(ok => {
  if (ok) {
    console.log(`✅  yt-dlp found  (${ytdlpVersion})`)
  } else {
    console.warn(`⚠️   yt-dlp NOT found on PATH.`)
    console.warn(`    Install it first:`)
    console.warn(`      Windows:  winget install yt-dlp`)
    console.warn(`      macOS:    brew install yt-dlp`)
    console.warn(`      Linux:    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp`)
    console.warn(`      Termux:   pkg install yt-dlp`)
    console.warn(`    Or set YTDLP_PATH env var to the full binary path.`)
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`\n🎵  Musicanaz Downloader (Node.js)`)
    console.log(`    Listening on  http://0.0.0.0:${PORT}`)
    console.log(`    Health check: http://localhost:${PORT}/health (or /download/health)\n`)
    console.log(`    To expose publicly:`)
    console.log(`      Cloudflare Tunnel:  cloudflared tunnel --url http://localhost:${PORT}`)
    console.log(`      ngrok:              ngrok http ${PORT}`)
    console.log(`\n    Then go to Musicanaz → Settings → Download Server`)
    console.log(`    and paste the public URL.\n`)
  })
})

server.on("error", err => {
  if (err.code === "EADDRINUSE") {
    console.error(`\n❌  Port ${PORT} is in use. Set PORT=XXXX to use a different port.\n`)
  } else {
    console.error("Server error:", err)
  }
  process.exit(1)
})
