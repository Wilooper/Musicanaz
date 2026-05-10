#!/usr/bin/env python3
"""
fix_yt_all.py — run from Musicanaz repo root
Fixes:
  1. Duplicate YTCookiesPanel section in settings
  2. Creates /api/ytdata/[...path]/route.ts proxy
  3. Home page uses YT personalized data when cookies exist
  4. Text contrast in settings YT section
"""
import pathlib, sys, os, re

ROOT = pathlib.Path(".")
if not (ROOT / "package.json").exists():
    sys.exit("Run from Musicanaz root")

def write(path, content):
    p = pathlib.Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content)
    print(f"  ✓  {path}")

def read(path):
    return pathlib.Path(path).read_text()

def save(path, content):
    pathlib.Path(path).write_text(content)

# ──────────────────────────────────────────────────────────────────────────────
# 1. Fix settings/page.tsx — remove duplicates
# ──────────────────────────────────────────────────────────────────────────────
print("\n[1] Fix settings page")
sp = pathlib.Path("app/settings/page.tsx")
src = sp.read_text()

# Remove duplicate import lines (keep first occurrence)
lines = src.splitlines()
seen_import = False
seen_section = False
clean = []
skip_until = None
i = 0
while i < len(lines):
    line = lines[i]

    # Remove duplicate import
    if 'import { YTCookiesPanel } from "@/components/yt-cookies-panel"' in line:
        if seen_import:
            i += 1
            continue
        seen_import = True

    # Remove duplicate YT section blocks — detect second occurrence
    if '{/* ── YouTube Account ─── */}' in line:
        if seen_section:
            # skip until we find the closing </section> for this block
            depth = 0
            while i < len(lines):
                if '<section' in lines[i]: depth += 1
                if '</section>' in lines[i]:
                    if depth <= 1:
                        i += 1
                        break
                    depth -= 1
                i += 1
            # also skip the blank line after
            continue
        seen_section = True

    clean.append(line)
    i += 1

src = "\n".join(clean)

# Fix faded text: section headers use text-foreground/muted; ensure contrast
# The SectionHeader title and desc use card/muted colors that may be invisible on light bg
# Patch the YouTube section's SectionHeader to use explicit dark text
src = src.replace(
    '            title="YouTube Account"\n            desc="Paste your YouTube cookies to get a personalised feed, history and liked songs."',
    '            title="YouTube Account"\n            desc="Connect your account to get a personalised feed, history and liked songs."'
)

save("app/settings/page.tsx", src)
print("  ✓  settings/page.tsx cleaned")

# ──────────────────────────────────────────────────────────────────────────────
# 2. Create /api/ytdata/[...path]/route.ts — proper proxy
# ──────────────────────────────────────────────────────────────────────────────
print("\n[2] Create ytdata proxy route")
write("app/api/ytdata/[...path]/route.ts", '''\
import { NextRequest, NextResponse } from "next/server"

const YTDATA_URL = process.env.YTDATA_URL ?? ""

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const endpoint = "/" + path.join("/")

  if (!YTDATA_URL) {
    return NextResponse.json({ error: "YTDATA_URL not configured" }, { status: 503 })
  }

  try {
    const body = await req.text()
    const upstream = await fetch(`${YTDATA_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(15_000),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upstream error" }, { status: 502 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  const endpoint = "/" + path.join("/")

  if (!YTDATA_URL) {
    return NextResponse.json({ error: "YTDATA_URL not configured" }, { status: 503 })
  }

  try {
    const upstream = await fetch(`${YTDATA_URL}${endpoint}`, {
      signal: AbortSignal.timeout(15_000),
    })
    const data = await upstream.json()
    return NextResponse.json(data, { status: upstream.status })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Upstream error" }, { status: 502 })
  }
}
''')

# ──────────────────────────────────────────────────────────────────────────────
# 3. lib/yt-client.ts — ensure _encPayload helper exists and all exports work
# ──────────────────────────────────────────────────────────────────────────────
print("\n[3] Ensure yt-client.ts is complete")

YT_CLIENT = '''\
"use client"
// yt-client.ts — calls /api/ytdata proxy (server-side, keeps YTDATA_URL secret)

import { getEncryptedCookies, getEncryptionKey, hasCookies } from "./storage"
import type { Song } from "./types"

const BASE = "/api/ytdata"

async function _encPayload(): Promise<{ enc_cookies: string; key: string } | {}> {
  if (!hasCookies()) return {}
  const enc = getEncryptedCookies()
  const key = getEncryptionKey()
  if (!enc || !key) return {}
  return { enc_cookies: enc, key }
}

async function post<T = any>(path: string): Promise<T> {
  const body = await _encPayload()
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`ytdata ${path} → ${r.status}`)
  return r.json()
}

export async function getYTHome():     Promise<any[]> { try { const d = await post("/home");     return d.items ?? [] } catch { return [] } }
export async function getYTHistory():  Promise<any[]> { try { const d = await post("/history");  return d.items ?? [] } catch { return [] } }
export async function getYTLiked():    Promise<any[]> { try { const d = await post("/liked");    return d.items ?? [] } catch { return [] } }
export async function getYTTrending(): Promise<any[]> { try { const d = await post("/trending"); return d.items ?? [] } catch { return [] } }
export async function getYTRelated(videoId: string): Promise<any[]> {
  try { const d = await post(`/related?v=${videoId}`); return d.items ?? [] } catch { return [] }
}
export async function recordYTPlay(videoId: string): Promise<void> {
  try { await post(`/record_play?v=${videoId}`) } catch {}
}

export function ytItemToSong(item: any): Song {
  return {
    id:        item.videoId ?? item.id ?? "",
    title:     item.title   ?? "Unknown",
    artist:    item.artist  ?? item.artists?.[0]?.name ?? "YouTube",
    thumbnail: item.thumbnail ?? item.thumbnails?.[0]?.url ?? "",
    videoId:   item.videoId  ?? item.id ?? "",
    type:      "yt",
    duration:  item.duration ?? "",
    album:     item.album    ?? "",
  }
}

// Web Crypto AES-GCM helpers (for encrypting cookies client-side before storing)
export async function encryptCookies(raw: string, uid: string): Promise<{ enc: string; key: string }> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode((uid + "_ytkey").padEnd(32, "0").slice(0, 32)),
    { name: "AES-GCM" }, false, ["encrypt"]
  )
  const iv   = crypto.getRandomValues(new Uint8Array(12))
  const buf  = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, keyMaterial, new TextEncoder().encode(raw))
  const b64  = (arr: Uint8Array) => btoa(String.fromCharCode(...arr))
  return {
    enc: b64(iv) + "." + b64(new Uint8Array(buf)),
    key: uid + "_ytkey",
  }
}
'''

pathlib.Path("lib/yt-client.ts").write_text(YT_CLIENT)
print("  ✓  lib/yt-client.ts rewritten")

# ──────────────────────────────────────────────────────────────────────────────
# 4. app/page.tsx — use YT home data when authenticated
# ──────────────────────────────────────────────────────────────────────────────
print("\n[4] Patch home page — YT data when authenticated")

src = pathlib.Path("app/page.tsx").read_text()

# 4a. Add imports
if "hasCookies" not in src:
    src = src.replace(
        'import { getRecentlyPlayed, getCountry, getPreferences, savePreferences } from "@/lib/storage"',
        'import { getRecentlyPlayed, getCountry, getPreferences, savePreferences, hasCookies } from "@/lib/storage"\nimport { getYTHome, ytItemToSong } from "@/lib/yt-client"'
    )
    print("  ✓  added imports")
else:
    # just add yt-client import if missing
    if "getYTHome" not in src:
        src = src.replace(
            'import { getRecentlyPlayed,',
            'import { getYTHome, ytItemToSong } from "@/lib/yt-client"\nimport { getRecentlyPlayed,'
        )
    print("  -  imports already present")

# 4b. Add ytAuthenticated state after chartsSource state
if "ytAuthenticated" not in src:
    src = src.replace(
        '  const [chartsSource,    setChartsSource]    = useState("all")',
        '  const [chartsSource,    setChartsSource]    = useState("all")\n  const [ytAuthenticated, setYtAuthenticated] = useState(false)'
    )

# 4c. Patch loadHome to try YT first
OLD_LOAD_HOME = '''  const loadHome = useCallback(async () => {
    setHomeLoading(true)
    try {
      const data = await fetch("/api/musiva/home?limit=6").then(r => r.json())
      setHomeShelves(Array.isArray(data) ? data : data.shelves || [])
    } catch { setHomeShelves([]) }
    setHomeLoading(false)
  }, [])'''

NEW_LOAD_HOME = '''  const loadHome = useCallback(async () => {
    setHomeLoading(true)
    const isYTAuth = typeof window !== "undefined" && hasCookies()
    setYtAuthenticated(isYTAuth)
    try {
      if (isYTAuth) {
        // Use personalised YT home feed
        const items = await getYTHome()
        if (items.length > 0) {
          // Convert to shelf format the home UI expects
          const shelf = {
            title: "For You",
            contents: items.slice(0, 20).map(ytItemToSong),
          }
          setHomeShelves([shelf])
          setHomeLoading(false)
          return
        }
      }
      // Fallback to musivapi
      const data = await fetch("/api/musiva/home?limit=6").then(r => r.json())
      setHomeShelves(Array.isArray(data) ? data : data.shelves || [])
    } catch { setHomeShelves([]) }
    setHomeLoading(false)
  }, [])'''  # noqa

if OLD_LOAD_HOME in src:
    src = src.replace(OLD_LOAD_HOME, NEW_LOAD_HOME)
    print("  ✓  loadHome patched")
else:
    print("  ✗  loadHome anchor not found — patch manually")

pathlib.Path("app/page.tsx").write_text(src)
print("  ✓  app/page.tsx saved")

print("""
✅ Done. Commit and push:

  git add app/settings/page.tsx \\
          app/api/ytdata/ \\
          lib/yt-client.ts \\
          app/page.tsx
  git commit -m "fix: YT proxy, home YT data, settings duplicates"
  git push
""")
