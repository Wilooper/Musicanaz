#!/usr/bin/env python3
"""
Musicanaz Downloader — Python
================================
Implements the MUSIVA v7 download API so Musicanaz can download songs
through your own machine instead of the remote server.

ENDPOINTS
---------
GET  /health                     — health check (Settings uses this)
GET  /download/health            — health check (alias)
POST /download/start             — { video_id } → { uid }
GET  /download/status/<uid>      — { status, progress, title, artist }
GET  /download/file/<uid>        — streams the finished audio file
POST /download/done/<uid>        — cleanup temp files

SETUP
-----
1. Install yt-dlp:
   pip install yt-dlp           # recommended — auto-updates with pip
   OR
   Windows:  winget install yt-dlp
   macOS:    brew install yt-dlp
   Linux:    sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \\
               -o /usr/local/bin/yt-dlp && sudo chmod +x /usr/local/bin/yt-dlp
   Termux:   pkg install yt-dlp

2. Run this server:
   python3 musicanaz-downloader.py

3. Expose publicly (pick one):
   Cloudflare Tunnel (free):
     cloudflared tunnel --url http://localhost:7891
   ngrok:
     ngrok http 7891
   LAN use (same Wi-Fi):
     http://192.168.x.x:7891

4. In Musicanaz → Settings → Download Server, paste the public URL
   and tap "Test & Save". OR set the env var on your Vercel project:
     DOWNLOAD_SERVER_URL=https://your-tunnel-url.trycloudflare.com

ENV VARS
--------
PORT=7891            Server port (default 7891)
HOST=0.0.0.0         Bind address
YTDLP_PATH=yt-dlp   Full path to yt-dlp binary if not on PATH
ALLOWED_ORIGIN=*    CORS origin

REQUIREMENTS
------------
Python 3.8+   (no pip packages needed for the server itself)
yt-dlp        (install separately — see above)
"""

from __future__ import annotations

import http.server
import json
import logging
import mimetypes
import os
import re
import secrets
import shutil
import subprocess
import tempfile
import threading
import time
import urllib.parse
from http import HTTPStatus
from pathlib import Path
from typing import Any

# ── Configuration ─────────────────────────────────────────────────────────────

PORT    = int(os.environ.get("PORT",   7891))
HOST    = os.environ.get("HOST",       "0.0.0.0")
YTDLP   = os.environ.get("YTDLP_PATH", "yt-dlp")
ORIGIN  = os.environ.get("ALLOWED_ORIGIN", "*")
# Always extract to mp3 for maximum player compatibility.
# Users can override with AUDIO_FORMAT=bestaudio if they prefer the raw format.
FORMAT      = os.environ.get("AUDIO_FORMAT", "bestaudio/best")
AUDIO_CODEC = os.environ.get("AUDIO_CODEC", "mp3")   # mp3 | m4a | opus | best

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("musicanaz-dl")

# ── Session store ──────────────────────────────────────────────────────────────

_sessions: dict[str, dict[str, Any]] = {}
_sessions_lock = threading.Lock()
SESSION_TTL = 3600  # 1 hour


def _cleanup_loop():
    while True:
        time.sleep(60)
        cutoff = time.time() - SESSION_TTL
        with _sessions_lock:
            dead = [uid for uid, s in _sessions.items() if s["created_at"] < cutoff]
        for uid in dead:
            with _sessions_lock:
                s = _sessions.pop(uid, {})
            fp = s.get("file_path")
            if fp and Path(fp).exists():
                try: os.unlink(fp)
                except Exception: pass


threading.Thread(target=_cleanup_loop, daemon=True).start()

# ── yt-dlp detection ──────────────────────────────────────────────────────────

_ytdlp_ok      = False
_ytdlp_version = "unknown"


def check_ytdlp() -> bool:
    global _ytdlp_ok, _ytdlp_version
    try:
        r = subprocess.run(
            [YTDLP, "--version"],
            capture_output=True, text=True, timeout=8,
        )
        if r.returncode == 0:
            _ytdlp_version = r.stdout.strip()
            _ytdlp_ok = True
            return True
    except Exception:
        pass
    return False

# ── Download worker ───────────────────────────────────────────────────────────


def _embed_metadata(filepath: str, title: str, artist: str, album: str, thumbnail_url: str, ext: str) -> None:
    """
    Embed title, artist, album and cover art into an audio-only file.

    Strategy per format:
      mp3  — ID3v2.3 tags + APIC attached picture (pure audio, no video stream)
      m4a  — MP4 atoms + cover art with attached_pic disposition
      ogg  — Vorbis comments (cover art skipped — limited player support)
      webm — Vorbis/Opus comments only (no cover art in webm)

    The key fix vs the old version: we NEVER add a video stream to the output.
    The old -map 1:v caused players to see the file as a video container.
    """
    import shutil, urllib.request, tempfile

    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found on PATH — install it to get metadata/cover art")

    # ── Download thumbnail ────────────────────────────────────────────────────
    thumb_path = None
    if thumbnail_url and ext in ("mp3", "m4a", "mp4"):
        try:
            tf = tempfile.NamedTemporaryFile(delete=False, suffix=".jpg")
            tf.close()
            req = urllib.request.Request(
                thumbnail_url,
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; Musicanaz/1.0)",
                    "Referer":    "https://www.youtube.com/",
                },
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                with open(tf.name, "wb") as f:
                    f.write(resp.read())
            thumb_path = tf.name
        except Exception as e:
            log.warning("Thumbnail download failed: %s", e)
            thumb_path = None

    out_path = filepath + ".out." + ext

    # ── Build ffmpeg command ──────────────────────────────────────────────────
    cmd = [ffmpeg, "-y", "-i", filepath]
    if thumb_path:
        cmd += ["-i", thumb_path]

    # Common metadata flags
    meta = [
        "-map_metadata", "-1",   # wipe all existing tags first
        "-metadata", f"title={title or ''}",
        "-metadata", f"artist={artist or ''}",
        "-metadata", f"album={album or title or ''}",
        "-metadata", f"comment=Musicanaz",
    ]

    if ext == "mp3":
        # MP3: -map 0:a  (audio only, NO -map 1:v for the main stream)
        # Cover art is added as an ID3 APIC frame, which is NOT a video stream —
        # it is embedded metadata. Players that understand ID3 show it as artwork.
        cmd += ["-map", "0:a"] + meta
        cmd += ["-codec:a", "copy", "-id3v2_version", "3"]
        if thumb_path:
            cmd += [
                "-map", "1:0",                  # the cover image input
                "-codec:v:0", "mjpeg",          # re-encode to baseline JPEG
                "-disposition:v:0", "attached_pic",  # mark as cover, NOT as video
                "-metadata:s:v", "comment=Cover (front)",
            ]

    elif ext in ("m4a", "mp4"):
        cmd += ["-map", "0:a"] + meta
        cmd += ["-codec:a", "copy"]
        if thumb_path:
            cmd += [
                "-map", "1:0",
                "-codec:v:0", "mjpeg",
                "-disposition:v:0", "attached_pic",
            ]

    else:
        # ogg / webm / opus — audio only, no cover art (avoid video streams)
        cmd += ["-map", "0:a", "-vn"] + meta
        cmd += ["-codec:a", "copy"]

    cmd.append(out_path)

    # ── Run ffmpeg ────────────────────────────────────────────────────────────
    result = subprocess.run(cmd, capture_output=True, timeout=90)

    if thumb_path:
        try: os.unlink(thumb_path)
        except Exception: pass

    if result.returncode != 0:
        try: os.unlink(out_path)
        except Exception: pass
        raise RuntimeError(
            f"ffmpeg exited {result.returncode}: "
            f"{result.stderr.decode(errors='replace')[-300:]}"
        )

    os.replace(out_path, filepath)


def _run_download(uid: str, video_id: str, title: str, artist: str, album: str = "", thumbnail_url: str = "") -> None:
    yt_url  = f"https://www.youtube.com/watch?v={video_id}"
    tmp_dir = tempfile.gettempdir()
    out_tpl = os.path.join(tmp_dir, f"musicanaz_{uid}.%(ext)s")

    with _sessions_lock:
        s = _sessions.get(uid)
        if s: s["status"] = "downloading"

    # --extract-audio converts to pure audio file (no video streams)
    # --audio-format mp3 ensures universal player compatibility
    # --audio-quality 0 = best quality for the chosen format
    args = [
        YTDLP, yt_url,
        "-f", FORMAT,
        "-o", out_tpl,
        "--extract-audio",
        "--audio-format", AUDIO_CODEC,
        "--audio-quality", "0",
        "--no-playlist",
        "--no-warnings",
        "--newline",
        "--progress",
    ]

    log.info("Starting download  uid=%s  videoId=%s", uid, video_id)

    try:
        proc = subprocess.Popen(
            args,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        for line in proc.stdout:          # type: ignore[union-attr]
            line = line.rstrip()
            m = re.search(r"\[download\]\s+([\d.]+)%", line)
            if m:
                pct = float(m.group(1))
                with _sessions_lock:
                    s = _sessions.get(uid)
                    if s:
                        s["progress"] = int(pct)
                        s["status"]   = "processing" if pct >= 100 else "downloading"

        proc.wait()

        if proc.returncode != 0:
            raise RuntimeError(f"yt-dlp exited with code {proc.returncode}")

        # Find the output file
        found = None
        for f in Path(tmp_dir).iterdir():
            if f.name.startswith(f"musicanaz_{uid}."):
                found = f
                break

        if not found:
            raise FileNotFoundError("Output file not found after download")

        ext  = found.suffix.lstrip(".")
        mime = (
            "audio/mpeg" if ext == "mp3"  else
            "audio/mp4"  if ext == "m4a"  else
            "audio/ogg"  if ext == "ogg"  else
            "audio/webm"
        )

        # ── Embed metadata with ffmpeg (best-effort) ──────────────────
        try:
            _embed_metadata(str(found), title, artist, album, thumbnail_url, ext)
        except Exception as me:
            log.warning("ffmpeg metadata skipped: %s", me)

        with _sessions_lock:
            s = _sessions.get(uid)
            if s:
                s["status"]    = "ready"
                s["progress"]  = 100
                s["file_path"] = str(found)
                s["ext"]       = ext
                s["mime"]      = mime

        log.info("Download ready  uid=%s  file=%s", uid, found.name)

    except Exception as exc:
        log.error("Download failed  uid=%s  error=%s", uid, exc)
        with _sessions_lock:
            s = _sessions.get(uid)
            if s:
                s["status"] = "error"
                s["error"]  = str(exc)

# ── Helpers ───────────────────────────────────────────────────────────────────

def _safe(s: str) -> str:
    return re.sub(r'[/\\?%*:|"<>]', "", str(s or "")).strip()[:80] or "track"


def _cors_headers(origin: str = "") -> dict[str, str]:
    return {
        "Access-Control-Allow-Origin":  ORIGIN if ORIGIN != "*" else (origin or "*"),
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
        "Access-Control-Max-Age":       "86400",
    }

# ── Request handler ───────────────────────────────────────────────────────────

class Handler(http.server.BaseHTTPRequestHandler):

    def log_message(self, fmt, *args):
        log.info(fmt, *args)

    def _origin(self) -> str:
        return self.headers.get("Origin", "")

    def _send_json(self, status: int, obj: Any) -> None:
        body = json.dumps(obj).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        for k, v in _cors_headers(self._origin()).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", 0))
        if length == 0:
            return {}
        try:
            return json.loads(self.rfile.read(length))
        except Exception:
            return {}

    # ── OPTIONS (CORS preflight) ───────────────────────────────────────────

    def do_OPTIONS(self):
        self.send_response(204)
        for k, v in _cors_headers(self._origin()).items():
            self.send_header(k, v)
        self.end_headers()

    # ── GET dispatcher ─────────────────────────────────────────────────────

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path   = parsed.path.rstrip("/")
        qs     = urllib.parse.parse_qs(parsed.query)

        if path in ("/health", "/download/health"):
            return self._handle_health()

        m = re.match(r"^/download/(status|file)/([a-f0-9]+)$", path)
        if m:
            action, uid = m.group(1), m.group(2)
            if action == "status": return self._handle_status(uid)
            if action == "file":
                filename = qs.get("filename", [None])[0]
                return self._handle_file(uid, filename)

        self._send_json(404, {"error": "Not found"})

    # ── POST dispatcher ────────────────────────────────────────────────────

    def do_POST(self):
        path = self.path.rstrip("/")

        if path == "/download/start":
            return self._handle_start()

        m = re.match(r"^/download/done/([a-f0-9]+)$", path)
        if m:
            return self._handle_done(m.group(1))

        self._send_json(404, {"error": "Not found"})

    # ── Handlers ───────────────────────────────────────────────────────────

    def _handle_health(self):
        with _sessions_lock:
            active = len(_sessions)
        self._send_json(200, {
            "ok":       True,
            "ytdlp":    _ytdlp_ok,
            "version":  _ytdlp_version,
            "server":   "Musicanaz Downloader (Python)",
            "sessions": active,
        })

    def _handle_start(self):
        if not _ytdlp_ok:
            return self._send_json(503, {"error": "yt-dlp not found. Install yt-dlp and restart the server."})

        body     = self._read_json()
        video_id = body.get("video_id", "")
        title    = body.get("title",     "")
        artist   = body.get("artist",   "")
        album    = body.get("album",    "")
        thumbnail_url = body.get("thumbnail", "")

        if not video_id:
            return self._send_json(400, {"error": "Missing video_id"})

        uid = secrets.token_hex(12)
        with _sessions_lock:
            _sessions[uid] = {
                "status":     "queued",
                "progress":   0,
                "title":      title,
                "artist":     artist,
                "file_path":  None,
                "ext":        "webm",
                "mime":       "audio/webm",
                "error":      None,
                "created_at": time.time(),
            }

        threading.Thread(
            target=_run_download,
            args=(uid, video_id, title, artist, album, thumbnail_url),
            daemon=True,
        ).start()

        self._send_json(200, {
            "uid":        uid,
            "status_url": f"/download/status/{uid}",
            "file_url":   f"/download/file/{uid}",
        })

    def _handle_status(self, uid: str):
        with _sessions_lock:
            s = _sessions.get(uid)
        if not s:
            return self._send_json(404, {"error": "Session not found"})
        self._send_json(200, {
            "uid":      uid,
            "status":   s["status"],
            "progress": s["progress"],
            "title":    s["title"],
            "artist":   s["artist"],
            "detail":   s.get("error"),
        })

    def _handle_file(self, uid: str, filename_override: str | None):
        with _sessions_lock:
            s = _sessions.get(uid)

        if not s:
            return self._send_json(404, {"error": "Session not found"})
        if s["status"] == "error":
            return self._send_json(500, {"error": s.get("error", "Download failed")})
        if s["status"] != "ready":
            return self._send_json(409, {"error": f"Not ready yet ({s['status']})"})

        fp = s.get("file_path")
        if not fp or not Path(fp).exists():
            return self._send_json(410, {"error": "File no longer available"})

        ext   = s.get("ext", "webm")
        mime  = s.get("mime", "audio/webm")
        fname = filename_override or f"{_safe(s['artist'])} - {_safe(s['title'])}.{ext}"
        size  = Path(fp).stat().st_size

        self.send_response(200)
        self.send_header("Content-Type",           mime)
        self.send_header("Content-Length",         str(size))
        self.send_header("Content-Disposition",
                         f"attachment; filename*=UTF-8''{urllib.parse.quote(fname)}")
        self.send_header("Cache-Control",          "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        for k, v in _cors_headers(self._origin()).items():
            self.send_header(k, v)
        self.end_headers()

        with open(fp, "rb") as fh:
            shutil.copyfileobj(fh, self.wfile)

    def _handle_done(self, uid: str):
        with _sessions_lock:
            s = _sessions.pop(uid, {})
        fp = s.get("file_path")
        if fp and Path(fp).exists():
            try: os.unlink(fp)
            except Exception: pass
        self._send_json(200, {"ok": True})


# ── Main ──────────────────────────────────────────────────────────────────────

class ThreadedServer(http.server.ThreadingHTTPServer):
    pass


def main():
    ok = check_ytdlp()
    if ok:
        log.info("yt-dlp found  (%s)", _ytdlp_version)
    else:
        log.warning("yt-dlp NOT found on PATH.")
        log.warning("Install it first:")
        log.warning("  pip install yt-dlp          ← recommended")
        log.warning("  OR  brew install yt-dlp     (macOS)")
        log.warning("  OR  pkg install yt-dlp      (Termux)")
        log.warning("  OR set YTDLP_PATH env var to the full binary path.")

    server = ThreadedServer((HOST, PORT), Handler)
    print(f"\n🎵  Musicanaz Downloader (Python)")
    print(f"    Listening on  http://{HOST}:{PORT}")
    print(f"    Health check: http://localhost:{PORT}/health  (alias: /download/health)\n")
    print(f"    To expose publicly:")
    print(f"      Cloudflare Tunnel:  cloudflared tunnel --url http://localhost:{PORT}")
    print(f"      ngrok:              ngrok http {PORT}\n")
    print(f"    Then go to Musicanaz → Settings → Download Server")
    print(f"    and paste the public URL.\n")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


if __name__ == "__main__":
    main()
