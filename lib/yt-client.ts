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
