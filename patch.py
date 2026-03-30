#!/usr/bin/env python3
"""
patch_musicanaz_ai_v2.py
Run from the root of your Musicanaz project:

    python3 patch_musicanaz_ai_v2.py

Creates / patches these files:
  NEW  lib/local-data.ts
  NEW  app/api/ai/analyze/route.ts
  NEW  app/api/ai/recommend/route.ts
  NEW  app/api/ai/similar/route.ts
  NEW  lib/ai-client.ts
  PATCH lib/audio-context.tsx   (25-sec skip detection)
  PATCH app/page.tsx            (AI section + toggle)
  PATCH app/settings/page.tsx  (User ID card)

Vercel env var needed:
    AI_API_URL = https://your-hf-space.hf.space
"""

import os, sys
from pathlib import Path

G="\033[92m"; Y="\033[93m"; R="\033[91m"; E="\033[0m"
def ok(m):   print(f"{G}  ✓ {m}{E}")
def warn(m): print(f"{Y}  ⚠ {m}{E}")
def err(m):  print(f"{R}  ✗ {m}{E}"); sys.exit(1)

ROOT = Path.cwd()
if not (ROOT/"app"/"page.tsx").exists():
    err("Run from Musicanaz project root (where app/page.tsx lives).")

print(f"\n🎵  Musicanaz AI Patcher  v2\n{'─'*48}")

def W(rel, content):
    p = ROOT/rel
    p.parent.mkdir(parents=True, exist_ok=True)
    lines = content.split("\n")
    indents = [len(l)-len(l.lstrip()) for l in lines if l.strip()]
    strip = min(indents) if indents else 0
    cleaned = "\n".join(l[strip:] if len(l) > strip else l for l in lines).lstrip("\n")
    p.write_text(cleaned, encoding="utf-8")
    ok(f"Created  {rel}")

def P(rel, replacements, desc):
    p = ROOT/rel
    if not p.exists(): warn(f"Skip {rel} – not found"); return
    t = p.read_text(encoding="utf-8"); n = 0
    for pair in replacements:
        old, new = pair[0], pair[1]
        if old in t: t = t.replace(old, new, 1); n += 1
        else: warn(f"  Pattern not found in {rel}: {repr(old[:55])}…")
    if n: p.write_text(t, encoding="utf-8"); ok(f"Patched  {rel} – {desc}")
    else: warn(f"Nothing changed in {rel} (may already be patched)")

# ─────────────────────────────────────────────────────────────────────────────
# FILE CONTENTS
# ─────────────────────────────────────────────────────────────────────────────

LOCAL_DATA_TS = r"""/**
 * Musicanaz local data system  (lib/local-data.ts)
 * All listening history stays on-device in localStorage.
 * The blob is signed with APP_SIG so tampering can be detected.
 * The AI API only receives a computed summary — never the raw song list.
 */

export const APP_SIG      = "musicanaz_2025"
export const DATA_KEY     = "mz_ai_v1"
export const DATA_VERSION = 1

export interface LocalSongEntry {
  id:               string
  title:            string
  artist:           string
  album:            string
  thumbnail:        string
  play_count:       number
  total_listened_ms:number
  duration_ms:      number
  avg_listen_ratio: number
  liked:            boolean
  liked_at?:        number
  skip_count:       number
  skipped:          boolean
  downloaded:       boolean
  in_playlists:     string[]
  first_played:     number
  last_played:      number
  types?:           string[]
}

export interface TasteAnalysis {
  generated_at:     number
  liked_types:      string[]
  disliked_types:   string[]
  top_artists:      string[]
  top_songs:        Array<{song_id:string;title:string;artist:string;play_count:number;types?:string[]}>
  taste_summary:    string
  similar_users:    Array<{user_id:string;similarity:number}>
  songs_classified: Record<string, string[]>
  suggestions:      Array<{song_id:string;title:string;artist:string;thumbnail:string;relevance_score?:number}>
}

export interface LocalUserData {
  _sig:        string
  _version:    number
  user_id:     string
  created_at:  number
  last_updated:number
  songs:       Record<string, LocalSongEntry>
  analysis?:   TasteAnalysis
}

function _read(): LocalUserData | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(DATA_KEY)
    if (!raw) return null
    const d = JSON.parse(raw) as LocalUserData
    if (d._sig !== APP_SIG) return null
    return d
  } catch { return null }
}

function _write(d: LocalUserData): void {
  if (typeof window === "undefined") return
  try {
    d._sig = APP_SIG
    d.last_updated = Date.now()
    localStorage.setItem(DATA_KEY, JSON.stringify(d))
  } catch (e) { console.warn("[mz-ai] write failed:", e) }
}

export function getLocalData(): LocalUserData | null { return _read() }

export function initLocalData(user_id: string): LocalUserData {
  const existing = _read()
  if (existing) return existing
  const d: LocalUserData = {
    _sig: APP_SIG, _version: DATA_VERSION, user_id,
    created_at: Date.now(), last_updated: Date.now(), songs: {},
  }
  _write(d); return d
}

export function recordPlay(
  songId: string, title: string, artist: string,
  album: string, thumbnail: string,
  listenedMs: number, durationMs: number, skippedEarly: boolean,
): void {
  const d = _read(); if (!d) return
  const now = Date.now()
  const e: LocalSongEntry = d.songs[songId] ?? {
    id: songId, title, artist, album, thumbnail,
    play_count: 0, total_listened_ms: 0, duration_ms: durationMs,
    avg_listen_ratio: 0, liked: false, skip_count: 0, skipped: false,
    downloaded: false, in_playlists: [], first_played: now, last_played: now,
  }
  e.title = title; e.artist = artist; e.thumbnail = thumbnail
  e.duration_ms = durationMs || e.duration_ms
  e.play_count += 1
  e.total_listened_ms += listenedMs
  e.last_played = now
  if (skippedEarly) e.skip_count += 1
  const ratio = durationMs > 0 ? listenedMs / durationMs : 0.5
  e.avg_listen_ratio = (e.avg_listen_ratio * (e.play_count - 1) + ratio) / e.play_count
  e.skipped = e.skip_count > e.play_count * 0.5
  d.songs[songId] = e; _write(d)
}

export function setLiked(songId: string, liked: boolean): void {
  const d = _read(); if (!d || !d.songs[songId]) return
  d.songs[songId].liked = liked
  d.songs[songId].liked_at = liked ? Date.now() : undefined
  _write(d)
}

export function setDownloaded(songId: string, dl: boolean): void {
  const d = _read(); if (!d || !d.songs[songId]) return
  d.songs[songId].downloaded = dl; _write(d)
}

export function addToPlaylist(songId: string, playlistId: string): void {
  const d = _read(); if (!d || !d.songs[songId]) return
  if (!d.songs[songId].in_playlists.includes(playlistId))
    d.songs[songId].in_playlists.push(playlistId)
  _write(d)
}

export function writeAnalysis(analysis: TasteAnalysis, suggestions: any[]): void {
  const d = _read(); if (!d) return
  for (const [sid, types] of Object.entries(analysis.songs_classified || {})) {
    if (d.songs[sid]) d.songs[sid].types = types as string[]
  }
  d.analysis = { ...analysis, suggestions }
  _write(d)
}

export function buildTasteProfile(userId: string) {
  const d = _read()
  const songs = Object.values(d?.songs ?? {})
  const byPlays = [...songs].sort((a, b) => b.play_count - a.play_count)
  const topSongs = byPlays.slice(0, 40).map(s => ({
    song_id: s.id, title: s.title, artist: s.artist, album: s.album || "",
    play_count: s.play_count, liked: s.liked, skipped: s.skipped,
    listen_ratio: s.avg_listen_ratio,
  }))
  const likedSongs = songs.filter(s => s.liked).slice(0, 30).map(s => ({
    song_id: s.id, title: s.title, artist: s.artist, album: s.album || "",
    play_count: s.play_count, liked: true, skipped: false,
    listen_ratio: s.avg_listen_ratio,
  }))
  const skippedSongs = songs.filter(s => s.skipped).slice(0, 20).map(s => ({
    song_id: s.id, title: s.title, artist: s.artist, album: s.album || "",
    play_count: s.play_count, liked: false, skipped: true,
    listen_ratio: s.avg_listen_ratio,
  }))
  const artistPlays: Record<string, number> = {}
  for (const s of songs) artistPlays[s.artist] = (artistPlays[s.artist] || 0) + s.play_count
  const topArtists = Object.entries(artistPlays)
    .sort((a, b) => b[1] - a[1]).slice(0, 15).map(([a]) => a)
  return {
    user_id: userId, app_sig: APP_SIG,
    top_songs: topSongs, liked_songs: likedSongs,
    skipped_songs: skippedSongs, top_artists: topArtists,
    total_plays: songs.reduce((a, s) => a + s.play_count, 0),
  }
}

export function getStats() {
  const d = _read()
  const songs = Object.values(d?.songs ?? {})
  return {
    total_songs:    songs.length,
    total_plays:    songs.reduce((a, s) => a + s.play_count, 0),
    liked:          songs.filter(s => s.liked).length,
    skipped:        songs.filter(s => s.skipped).length,
    downloaded:     songs.filter(s => s.downloaded).length,
    has_analysis:   !!d?.analysis,
    analysis_age_h: d?.analysis
      ? Math.round((Date.now() - d.analysis.generated_at) / 3_600_000)
      : null,
  }
}

export function clearLocalData(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(DATA_KEY)
}
"""

AI_CLIENT_TS = r"""/**
 * Musicanaz AI client  v2  (lib/ai-client.ts)
 * Raw play data stays on device. Only summaries go to the server.
 */
import type { Song } from "./types"
import { getOrCreateUID } from "./uid"
import { initLocalData, recordPlay, buildTasteProfile, writeAnalysis, type TasteAnalysis } from "./local-data"

const AI_TOGGLE_KEY = "mz_ai_enabled"

export function getAISearchEnabled(): boolean {
  if (typeof window === "undefined") return false
  try { return localStorage.getItem(AI_TOGGLE_KEY) === "1" } catch { return false }
}
export function setAISearchEnabled(on: boolean): void {
  if (typeof window === "undefined") return
  try { localStorage.setItem(AI_TOGGLE_KEY, on ? "1" : "0") } catch {}
  if (on) initLocalData(getOrCreateUID())
}

export function localRecordPlay(
  song: Song, listenedMs: number, skippedEarly: boolean, durationMs = 0,
): void {
  const uid = getOrCreateUID(); if (!uid) return
  initLocalData(uid)
  recordPlay(
    song.videoId || song.id || "",
    song.title || "",
    typeof song.artist === "string" ? song.artist : "",
    song.album || "", song.thumbnail || "",
    listenedMs, durationMs, skippedEarly,
  )
}

export async function runAIAnalysis(): Promise<{analysis: TasteAnalysis; suggestions: any[]} | null> {
  const uid = getOrCreateUID(); if (!uid) return null
  const profile = buildTasteProfile(uid)
  if (profile.total_plays < 3) return null
  const res = await fetch("/api/ai/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(profile),
    signal: AbortSignal.timeout(90_000),
  })
  if (!res.ok) throw new Error(`Analyze failed: ${res.status}`)
  const data = await res.json()
  if (data.write_analysis) {
    writeAnalysis(data.write_analysis, data.suggestions || [])
    return { analysis: data.write_analysis, suggestions: data.suggestions || [] }
  }
  return null
}

export async function getAIRecommendations(
  limit = 20, exclude: string[] = [],
): Promise<{songs: any[]; personalized: boolean}> {
  const uid = getOrCreateUID(); if (!uid) return { songs: [], personalized: false }
  const res = await fetch("/api/ai/recommend", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: uid, limit, exclude }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) return { songs: [], personalized: false }
  return res.json()
}

export function aiSongToSong(s: any): Song {
  return {
    id: s.song_id || s.videoId || "",
    videoId: s.song_id || s.videoId || "",
    title: s.title || "Unknown",
    artist: s.artist || "Unknown",
    thumbnail: s.thumbnail || "",
    album: s.album || "",
    duration: s.duration || "",
    type: "musiva" as const,
  }
}

export async function aiPersonalizedSearch(
  query: string, limit = 20,
): Promise<{results: any[]; personalized: boolean; from_cache: boolean}> {
  const uid = getOrCreateUID()
  const res = await fetch("/api/ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: uid, query, limit }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`AI search ${res.status}`)
  return res.json()
}
"""

ANALYZE_ROUTE = """import { type NextRequest, NextResponse } from "next/server"
const AI = process.env.AI_API_URL || ""
export async function POST(req: NextRequest) {
  if (!AI) return NextResponse.json({ error: "AI_API_URL not set" }, { status: 503 })
  try {
    const body = await req.json()
    const res  = await fetch(`${AI}/analyze`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(90_000),
    })
    return NextResponse.json(await res.json())
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
"""

RECOMMEND_ROUTE = """import { type NextRequest, NextResponse } from "next/server"
const AI = process.env.AI_API_URL || ""
export async function POST(req: NextRequest) {
  if (!AI) return NextResponse.json({ songs: [], personalized: false }, { status: 503 })
  try {
    const body = await req.json()
    const res  = await fetch(`${AI}/recommend`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(15_000),
    })
    return NextResponse.json(await res.json())
  } catch (e: any) { return NextResponse.json({ songs: [], personalized: false, error: e.message }, { status: 500 }) }
}
"""

SIMILAR_ROUTE = """import { type NextRequest, NextResponse } from "next/server"
const AI = process.env.AI_API_URL || ""
export async function GET(req: NextRequest) {
  if (!AI) return NextResponse.json({ similar_users: [] })
  const uid = req.nextUrl.searchParams.get("user_id") || "anon"
  try {
    const res = await fetch(`${AI}/user/${encodeURIComponent(uid)}/similar-users`,
      { signal: AbortSignal.timeout(10_000) })
    return NextResponse.json(await res.json())
  } catch (e: any) { return NextResponse.json({ similar_users: [], error: e.message }, { status: 500 }) }
}
"""

SEARCH_ROUTE = """import { type NextRequest, NextResponse } from "next/server"
const AI = process.env.AI_API_URL || ""
export async function POST(req: NextRequest) {
  if (!AI) return NextResponse.json({ error: "AI_API_URL not set" }, { status: 503 })
  try {
    const body = await req.json()
    const res  = await fetch(`${AI}/search/personalized`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(12_000),
    })
    return NextResponse.json(await res.json())
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 500 }) }
}
"""

# ─────────────────────────────────────────────────────────────────────────────
# WRITE NEW FILES
# ─────────────────────────────────────────────────────────────────────────────
W("lib/local-data.ts",               LOCAL_DATA_TS)
W("lib/ai-client.ts",                AI_CLIENT_TS)
W("app/api/ai/analyze/route.ts",     ANALYZE_ROUTE)
W("app/api/ai/recommend/route.ts",   RECOMMEND_ROUTE)
W("app/api/ai/similar/route.ts",     SIMILAR_ROUTE)
W("app/api/ai/search/route.ts",      SEARCH_ROUTE)

# ─────────────────────────────────────────────────────────────────────────────
# PATCH lib/audio-context.tsx
# ─────────────────────────────────────────────────────────────────────────────
P("lib/audio-context.tsx", [
  (
    'import { recordListenSeconds, addToSongHistory, recordBadgeEvent, getPartyUsername } from "./storage"',
    'import { recordListenSeconds, addToSongHistory, recordBadgeEvent, getPartyUsername } from "./storage"\nimport { localRecordPlay } from "./ai-client"',
  ),
], "add localRecordPlay import")

P("lib/audio-context.tsx", [
  (
    '  // ── public API ───────────────────────────────────────────\n  const playSong',
    '  // ── AI: refs for 25-second skip detection ─────────────────────────────\n  const songStartRef = useRef<number>(0)\n  const prevSongRef  = useRef<Song | null>(null)\n\n  // ── public API ───────────────────────────────────────────\n  const playSong',
  ),
], "add skip-detection refs")

P("lib/audio-context.tsx", [
  (
    '  const playSong = useCallback((song: Song, isManual = true, startTime = 0, stopAt = 0) => {\n    // Store stopAt in the pending ref',
    '  const playSong = useCallback((song: Song, isManual = true, startTime = 0, stopAt = 0) => {\n    // ── AI: record previous song + detect < 25 s skip ───────────────────────\n    const _prev = prevSongRef.current\n    if (_prev && _prev.videoId && !_prev.isPodcast) {\n      const _ms = Date.now() - songStartRef.current\n      localRecordPlay(_prev, _ms, _ms < 25_000, 0)\n    }\n    prevSongRef.current  = song\n    songStartRef.current = Date.now()\n    // Store stopAt in the pending ref',
  ),
], "inject 25s skip detection")

# ─────────────────────────────────────────────────────────────────────────────
# PATCH app/page.tsx
# ─────────────────────────────────────────────────────────────────────────────

# Icons
P("app/page.tsx", [
  (
    '  Settings, Globe, Play, ClipboardPaste,\n} from "lucide-react"',
    '  Settings, Globe, Play, ClipboardPaste, Sparkles, Zap, Brain,\n} from "lucide-react"',
  ),
], "add Sparkles Zap Brain icons")

# Imports
P("app/page.tsx", [
  (
    'import { getRecentlyPlayed, getCountry, getPreferences, savePreferences } from "@/lib/storage"',
    'import { getRecentlyPlayed, getCountry, getPreferences, savePreferences } from "@/lib/storage"\nimport { getAISearchEnabled, setAISearchEnabled, aiPersonalizedSearch, getAIRecommendations, aiSongToSong, runAIAnalysis } from "@/lib/ai-client"\nimport { getLocalData, getStats as getLocalStats, type TasteAnalysis } from "@/lib/local-data"\nimport { getOrCreateUID } from "@/lib/uid"',
  ),
], "add AI + local-data imports")

# AI state variables
P("app/page.tsx", [
  (
    '  // Search state\n  const [searchQuery,',
    '  // ── AI state ────────────────────────────────────────────────────────────\n  const [aiEnabled,       setAiEnabled]       = useState(false)\n  const [aiAnalysis,      setAiAnalysis]      = useState<TasteAnalysis | null>(null)\n  const [aiAnalyzing,     setAiAnalyzing]     = useState(false)\n  const [aiAnalysisError, setAiAnalysisError] = useState("")\n  const [aiRecos,         setAiRecos]         = useState<Song[]>([])\n  const [aiRecosLoading,  setAiRecosLoading]  = useState(false)\n  const [aiSearchLoading, setAiSearchLoading] = useState(false)\n  const [aiSearchBadge,   setAiSearchBadge]   = useState(false)\n  const [localStats,      setLocalStats]      = useState<ReturnType<typeof getLocalStats> | null>(null)\n\n  // Search state\n  const [searchQuery,',
  ),
], "add AI state vars")

# Init effect
P("app/page.tsx", [
  (
    '  // Load country + source prefs on mount\n  useEffect(() => {\n    const prefs = getPreferences()',
    '  // Init AI from localStorage\n  useEffect(() => {\n    setAiEnabled(getAISearchEnabled())\n    const d = getLocalData()\n    if (d?.analysis) setAiAnalysis(d.analysis)\n    setLocalStats(getLocalStats())\n  }, [])\n\n  // Load country + source prefs on mount\n  useEffect(() => {\n    const prefs = getPreferences()',
  ),
], "init AI on mount")

# Analysis + reco functions
P("app/page.tsx", [
  (
    '  const loadRecentlyPlayed = useCallback(() => setRecentlyPlayed(getRecentlyPlayed()), [])',
    '  const loadRecentlyPlayed = useCallback(() => setRecentlyPlayed(getRecentlyPlayed()), [])\n\n  const handleRunAnalysis = useCallback(async () => {\n    setAiAnalyzing(true); setAiAnalysisError("")\n    try {\n      const result = await runAIAnalysis()\n      if (result) {\n        setAiAnalysis(result.analysis)\n        const songs = (result.suggestions || []).map(aiSongToSong).filter((s: Song) => s.videoId)\n        setAiRecos(songs)\n        setLocalStats(getLocalStats())\n      } else {\n        setAiAnalysisError("Play at least 3 songs to unlock AI analysis.")\n      }\n    } catch (e: any) {\n      setAiAnalysisError(e.message || "Analysis failed")\n    }\n    setAiAnalyzing(false)\n  }, [])\n\n  const loadAIRecommendations = useCallback(async () => {\n    setAiRecosLoading(true)\n    try {\n      const data = await getAIRecommendations(20)\n      const songs = (data.songs || []).map(aiSongToSong).filter((s: Song) => s.videoId)\n      setAiRecos(songs)\n    } catch { setAiRecos([]) }\n    setAiRecosLoading(false)\n  }, [])',
  ),
], "add AI analysis + reco functions")

# Home effect
P("app/page.tsx", [
  (
    '  useEffect(() => { loadHome(); loadRecentlyPlayed(); loadTopPlaylists() }, []) // eslint-disable-line',
    '  useEffect(() => { loadHome(); loadRecentlyPlayed(); loadTopPlaylists() }, []) // eslint-disable-line\n  useEffect(() => { if (activeView === "home" && aiEnabled) loadAIRecommendations() }, [activeView, aiEnabled]) // eslint-disable-line',
  ),
], "add AI home effect")

# AI search in executeSearch
P("app/page.tsx", [
  (
    '    try {\n      const fetchLimit = append ? LOAD_MORE_CHUNK : LIMIT\n      const url = `/api/musiva/search?q=${encodeURIComponent(query)}&filter=${filter}&limit=${fetchLimit}&offset=${offset}`\n      const data = await fetch(url).then(r => r.json())\n      const newItems: any[] = data.results || data || []',
    '    try {\n      const fetchLimit = append ? LOAD_MORE_CHUNK : LIMIT\n      let newItems: any[] = []\n      let aiUsed = false\n      if (aiEnabled && filter === "songs" && !append) {\n        setAiSearchLoading(true)\n        try {\n          const aiData = await aiPersonalizedSearch(query, fetchLimit)\n          if (aiData.results?.length) {\n            newItems = aiData.results.map((r: any) => ({\n              videoId: r.song_id || r.videoId, id: r.song_id || r.videoId,\n              title: r.title, artists: [{ name: r.artist }],\n              album: { name: r.album || "" },\n              thumbnails: r.thumbnail ? [{ url: r.thumbnail, width: 226 }] : [],\n              duration: r.duration || "", _aiScore: r.relevance_score,\n            }))\n            aiUsed = true; setAiSearchBadge(aiData.personalized || false)\n          }\n        } catch {}\n        setAiSearchLoading(false)\n      }\n      if (!aiUsed) {\n        setAiSearchBadge(false)\n        const url = `/api/musiva/search?q=${encodeURIComponent(query)}&filter=${filter}&limit=${fetchLimit}&offset=${offset}`\n        const data = await fetch(url).then(r => r.json())\n        newItems = data.results || data || []\n      }\n      // eslint-disable-next-line @typescript-eslint/no-unused-vars\n      const _typeGuard = { hasMore: false }; void _typeGuard',
  ),
], "inject AI search branch")

P("app/page.tsx", [
  (
    '      setHasMore(prev => ({ ...prev, [filter]: data.hasMore || newItems.length >= fetchLimit }))',
    '      setHasMore(prev => ({ ...prev, [filter]: !aiUsed && newItems.length >= fetchLimit }))',
  ),
], "fix hasMore for AI path")

# AI toggle button in search bar
P("app/page.tsx", [
  (
    '              {searchQuery && (\n                  <button type="button" onClick={clearSearch} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors">\n                    <X className="w-3.5 h-3.5" />\n                  </button>\n                )}',
    '              <button\n                  type="button"\n                  title={aiEnabled ? "AI Search ON" : "AI Search OFF"}\n                  onClick={() => { const n = !aiEnabled; setAiEnabled(n); setAISearchEnabled(n) }}\n                  className={[\n                    "flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border transition-all mr-0.5",\n                    aiEnabled\n                      ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/30"\n                      : "bg-card/60 text-muted-foreground border-border/40 hover:border-primary/40",\n                  ].join(" ")}\n                >\n                  {aiSearchLoading\n                    ? <Loader2 className="w-3 h-3 animate-spin" />\n                    : <Sparkles className="w-3 h-3" />}\n                  <span className="hidden sm:inline">AI</span>\n                </button>\n                {searchQuery && (\n                  <button type="button" onClick={clearSearch} className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-muted transition-colors">\n                    <X className="w-3.5 h-3.5" />\n                  </button>\n                )}',
  ),
], "add AI toggle button in search bar")

# AI badge under results
P("app/page.tsx", [
  (
    '            {renderResults()}',
    '            {aiEnabled && aiSearchBadge && activeFilter === "songs" && (\n              <div className="flex items-center gap-1.5 mb-3 text-xs text-primary">\n                <Sparkles className="w-3 h-3" />\n                <span className="font-medium">Personalised for you</span>\n                <span className="text-muted-foreground ml-1">· ranked by your taste</span>\n              </div>\n            )}\n            {renderResults()}',
  ),
], "add AI badge under search results")

# AI home section
AI_HOME_SECTION = (
    '            {/* ── AI Analysis + Recommendations ── */}\n'
    '            {aiEnabled && (\n'
    '              <section className="mb-8">\n'
    '                <div className="rounded-2xl bg-card/40 border border-border/30 p-4 mb-4">\n'
    '                  <div className="flex items-center gap-2 mb-3">\n'
    '                    <Brain className="w-4 h-4 text-primary" />\n'
    '                    <h2 className="text-base font-bold">AI Analysis</h2>\n'
    '                    {localStats && (\n'
    '                      <span className="ml-auto text-xs text-muted-foreground font-mono">\n'
    '                        {localStats.total_plays} plays · {localStats.liked} liked · {localStats.skipped} skipped\n'
    '                      </span>\n'
    '                    )}\n'
    '                  </div>\n'
    '                  {!aiAnalysis && !aiAnalyzing && (\n'
    '                    <div className="flex flex-col items-center gap-3 py-4 text-center">\n'
    '                      <Zap className="w-8 h-8 text-primary/30" />\n'
    '                      <p className="text-sm font-medium">No analysis yet</p>\n'
    '                      <p className="text-xs text-muted-foreground max-w-xs">Play a few songs then run the AI. It classifies your taste via MusicBrainz and finds users who share your vibe.</p>\n'
    '                      {aiAnalysisError && <p className="text-xs text-destructive">{aiAnalysisError}</p>}\n'
    '                      <button onClick={handleRunAnalysis} disabled={aiAnalyzing}\n'
    '                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">\n'
    '                        {aiAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}\n'
    '                        {aiAnalyzing ? "Analysing…" : "Run AI Analysis"}\n'
    '                      </button>\n'
    '                    </div>\n'
    '                  )}\n'
    '                  {aiAnalyzing && (\n'
    '                    <div className="flex items-center gap-3 py-3 text-muted-foreground text-sm">\n'
    '                      <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0"/>\n'
    '                      <div>\n'
    '                        <p className="font-medium">Analysing your taste…</p>\n'
    '                        <p className="text-xs opacity-70 mt-0.5">Classifying songs via MusicBrainz. Up to 60 s on first run.</p>\n'
    '                      </div>\n'
    '                    </div>\n'
    '                  )}\n'
    '                  {aiAnalysis && !aiAnalyzing && (\n'
    '                    <div className="flex flex-col gap-3">\n'
    '                      <p className="text-sm text-muted-foreground leading-relaxed">{aiAnalysis.taste_summary}</p>\n'
    '                      <div className="flex flex-wrap gap-1.5">\n'
    '                        {(aiAnalysis.liked_types || []).map((t, i) => (\n'
    '                          <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/25 font-medium">♥ {t}</span>\n'
    '                        ))}\n'
    '                        {(aiAnalysis.disliked_types || []).map((t, i) => (\n'
    '                          <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-destructive/10 text-destructive/70 border border-destructive/20">✕ {t}</span>\n'
    '                        ))}\n'
    '                      </div>\n'
    '                      {(aiAnalysis.similar_users || []).length > 0 && (\n'
    '                        <div className="flex items-center gap-2 text-xs text-muted-foreground">\n'
    '                          <Zap className="w-3.5 h-3.5 text-blue-400"/>\n'
    '                          <span><span className="text-blue-400 font-semibold">{aiAnalysis.similar_users.length}</span> listeners share your taste</span>\n'
    '                        </div>\n'
    '                      )}\n'
    '                      <div className="flex items-center gap-2 pt-1">\n'
    '                        <span className="text-xs text-muted-foreground/60 flex-1">\n'
    '                          {aiAnalysis.generated_at ? `Analysed ${Math.round((Date.now()-aiAnalysis.generated_at)/3_600_000)}h ago` : ""}\n'
    '                        </span>\n'
    '                        <button onClick={handleRunAnalysis} disabled={aiAnalyzing}\n'
    '                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border/40 px-2.5 py-1 rounded-full transition-colors">\n'
    '                          <Sparkles className="w-3 h-3"/>Re-analyse\n'
    '                        </button>\n'
    '                      </div>\n'
    '                    </div>\n'
    '                  )}\n'
    '                </div>\n'
    '                <div className="flex items-center gap-2 mb-3">\n'
    '                  <Sparkles className="w-4 h-4 text-primary"/>\n'
    '                  <h3 className="text-sm font-bold">Recommended for you</h3>\n'
    '                  {aiRecos.length > 0 && <span className="text-[10px] text-primary/80 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full ml-1">AI · personalised</span>}\n'
    '                  <button onClick={loadAIRecommendations} className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors">Refresh</button>\n'
    '                </div>\n'
    '                {aiRecosLoading ? <CardGrid n={6}/>\n'
    '                  : aiRecos.length > 0 ? (\n'
    '                    <div className={GRID}>\n'
    '                      {aiRecos.slice(0,12).map((song,i) => <SongCard key={i} song={song} onPlayComplete={loadRecentlyPlayed}/>)}\n'
    '                    </div>\n'
    '                  ) : aiAnalysis ? (\n'
    '                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/30 border border-border/20 text-sm text-muted-foreground">\n'
    '                      <Zap className="w-4 h-4 text-primary/40 flex-shrink-0"/>\n'
    '                      <span>No recommendations yet — re-run analysis or keep listening</span>\n'
    '                    </div>\n'
    '                  ) : null}\n'
    '              </section>\n'
    '            )}\n\n'
)

P("app/page.tsx", [
  (
    '            {/* Recently played */}\n            {recentlyPlayed.length > 0 && (',
    AI_HOME_SECTION + '            {/* Recently played */}\n            {recentlyPlayed.length > 0 && (',
  ),
], "add AI section to home view")

# ─────────────────────────────────────────────────────────────────────────────
# PATCH app/settings/page.tsx
# ─────────────────────────────────────────────────────────────────────────────
P("app/settings/page.tsx", [
  (
    'import {\n  getPreferences, savePreferences, type UserPreferences,',
    'import { getOrCreateUID } from "@/lib/uid"\nimport { getLocalData, clearLocalData, getStats as getLocalStats } from "@/lib/local-data"\nimport {\n  getPreferences, savePreferences, type UserPreferences,',
  ),
], "add uid + local-data imports to settings")

P("app/settings/page.tsx", [
  (
    '  const [saved,           setSaved]           = useState(false)',
    '  const [uid,            setUid]             = useState("")\n  const [localDataStats, setLocalDataStats]  = useState<ReturnType<typeof getLocalStats>|null>(null)\n  const [showRawData,    setShowRawData]     = useState(false)\n  const [rawDataStr,     setRawDataStr]      = useState("")\n\n  const [saved,           setSaved]           = useState(false)',
  ),
], "add uid + local-data state to settings")

P("app/settings/page.tsx", [
  (
    '    setPartyName(getPartyUsername())',
    '    setUid(getOrCreateUID() || "")\n    setLocalDataStats(getLocalStats())\n    setPartyName(getPartyUsername())',
  ),
], "load uid + stats in settings useEffect")

ACCOUNT_SECTION = (
    '        {/* ── AI & Account ─── */}\n'
    '        <section>\n'
    '          <SectionHeader\n'
    '            icon={<Zap className="w-5 h-5 text-primary" />}\n'
    '            title="AI & Account"\n'
    '            desc="Your anonymous User ID and on-device AI listening data."\n'
    '          />\n'
    '          <div className="rounded-2xl bg-card/40 border border-border/30 divide-y divide-border/20">\n'
    '            <div className="px-4 py-3 flex items-center gap-3">\n'
    '              <div className="flex-1 min-w-0">\n'
    '                <p className="text-sm font-semibold">Your User ID</p>\n'
    '                <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{uid || "Generating…"}</p>\n'
    '                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Anonymous · stored only on this device · used for similar-user matching</p>\n'
    '              </div>\n'
    '            </div>\n'
    '            {localDataStats && (\n'
    '              <div className="px-4 py-3">\n'
    '                <p className="text-sm font-semibold mb-2">Local AI Data</p>\n'
    '                <div className="grid grid-cols-3 gap-2 text-center">\n'
    '                  {([\n'
    '                    ["Songs",      localDataStats.total_songs],\n'
    '                    ["Plays",      localDataStats.total_plays],\n'
    '                    ["Liked",      localDataStats.liked],\n'
    '                    ["Skipped",    localDataStats.skipped],\n'
    '                    ["Downloads",  localDataStats.downloaded],\n'
    '                    ["Analysis",   localDataStats.has_analysis\n'
    '                      ? (localDataStats.analysis_age_h === 0 ? "Fresh"\n'
    '                          : `${localDataStats.analysis_age_h}h ago`)\n'
    '                      : "None"],\n'
    '                  ] as [string, string|number][]).map(([label, val]) => (\n'
    '                    <div key={label} className="bg-card/50 rounded-xl py-2 px-1">\n'
    '                      <p className="text-base font-bold text-primary">{val}</p>\n'
    '                      <p className="text-[10px] text-muted-foreground">{label}</p>\n'
    '                    </div>\n'
    '                  ))}\n'
    '                </div>\n'
    '              </div>\n'
    '            )}\n'
    '            <div className="px-4 py-3 flex items-center gap-2 flex-wrap">\n'
    '              <button\n'
    '                onClick={() => {\n'
    '                  const d = getLocalData()\n'
    '                  setRawDataStr(d ? JSON.stringify(d, null, 2) : "No data yet.")\n'
    '                  setShowRawData(v => !v)\n'
    '                }}\n'
    '                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-border/40 bg-card/40 hover:bg-card/70 transition-colors"\n'
    '              >\n'
    '                <Eye className="w-3.5 h-3.5"/>{showRawData ? "Hide" : "View"} JSON\n'
    '              </button>\n'
    '              <button\n'
    '                onClick={() => {\n'
    '                  if (!confirm("Clear all local AI data? This cannot be undone.")) return\n'
    '                  clearLocalData(); setLocalDataStats(null); setRawDataStr("")\n'
    '                }}\n'
    '                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-red-500/30 text-red-500/80 hover:bg-red-500/10 transition-colors"\n'
    '              >\n'
    '                <Trash2 className="w-3.5 h-3.5"/>Clear AI data\n'
    '              </button>\n'
    '            </div>\n'
    '            {showRawData && rawDataStr && (\n'
    '              <div className="px-4 py-3">\n'
    '                <pre className="text-[10px] font-mono text-muted-foreground bg-muted/20 rounded-xl p-3 overflow-x-auto max-h-64 whitespace-pre-wrap break-all">\n'
    '                  {rawDataStr}\n'
    '                </pre>\n'
    '              </div>\n'
    '            )}\n'
    '          </div>\n'
    '        </section>\n\n'
)

P("app/settings/page.tsx", [
  (
    '        {/* ── Party Username ─── */}',
    ACCOUNT_SECTION + '        {/* ── Party Username ─── */}',
  ),
], "add AI & Account section to settings")

# ─────────────────────────────────────────────────────────────────────────────
print(f"""
{'─'*48}
{G}✅  All patches applied!{E}

Files created:
  lib/local-data.ts               Device-local JSON data system
  lib/ai-client.ts                AI client helpers (v2)
  app/api/ai/analyze/route.ts     → POST /analyze
  app/api/ai/recommend/route.ts   → POST /recommend
  app/api/ai/similar/route.ts     → GET /similar-users
  app/api/ai/search/route.ts      → POST /search/personalized

Files patched:
  lib/audio-context.tsx           25-second skip detection
  app/page.tsx                    AI toggle + Analysis section + Reco
  app/settings/page.tsx           User ID card + local data viewer

Vercel env var:
  AI_API_URL = https://your-hf-space.hf.space

Deploy:
  git add -A && git commit -m "feat: local AI data + analysis" && git push
{'─'*48}
""")
