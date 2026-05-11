"use client"
import {
  getEncryptedCookies, setEncryptedCookies,
  clearEncryptedCookies, hasCookies,
} from "./storage"
import type { Song } from "./types"

const BASE = "/api/ytdata"

// Store cookies as base64 in localStorage (SafeStore prefix for privacy)
export function cookiesAreSet(): boolean {
  return typeof window !== "undefined" && hasCookies()
}

export function saveCookies(raw: string): void {
  const b64 = btoa(unescape(encodeURIComponent(raw)))
  setEncryptedCookies(b64)          // reuse the safe slot
}

export function removeCookies(): void {
  clearEncryptedCookies()
}

function _payload(): object {
  if (!hasCookies()) return {}
  const c = getEncryptedCookies()
  if (!c) return {}
  return { cookies: c }             // base64 string, server decodes it
}

async function post<T = any>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(_payload()),
  })
  if (!r.ok) throw new Error(`ytdata ${path} → ${r.status}`)
  return r.json()
}

export async function getYTHome():     Promise<any[]> { try { return (await post<any>("/home")).items     ?? [] } catch { return [] } }
export async function getYTHistory():  Promise<any[]> { try { return (await post<any>("/history")).items  ?? [] } catch { return [] } }
export async function getYTLiked():    Promise<any[]> { try { return (await post<any>("/liked")).items    ?? [] } catch { return [] } }
export async function getYTTrending(): Promise<any[]> { try { return (await post<any>("/trending")).items ?? [] } catch { return [] } }
export async function getYTRelated(videoId: string): Promise<any[]> {
  try { return (await post<any>(`/related?v=${videoId}`)).items ?? [] } catch { return [] }
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
