/**
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
