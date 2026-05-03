/**
 * Musicanaz YT Client  (lib/yt-client.ts)
 * ─────────────────────────────────────────────────────────────────────────────
 * Sends encrypted cookies to ytdata-go for personalised YouTube data.
 * Encryption/decryption happens entirely client-side via Web Crypto API.
 * The server is stateless — it decrypts, uses, and discards cookies per request.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { getEncryptedCookies, getEncryptionKey, hasCookies, setEncryptedCookies, setEncryptionKey, clearEncryptedCookies } from "./storage"
import { getOrCreateUID } from "./uid"

const YTDATA_URL = process.env.NEXT_PUBLIC_YTDATA_URL ?? ""

// ── Types ─────────────────────────────────────────────────────────────────────

export interface YTSongItem {
  videoId:   string
  title:     string
  artist:    string
  album:     string
  thumbnail: string
  duration:  string
}

export interface YTSection {
  title: string
  items: YTSongItem[]
}

export interface YTHomeFeed {
  sections: YTSection[]
}

// ── AES-GCM encryption helpers (Web Crypto) ───────────────────────────────────

/** Derive a 256-bit AES key from a passphrase using SHA-256. */
async function deriveKey(passphrase: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(passphrase))
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"])
}

/** Encrypt UTF-8 plaintext → base64url(nonce || ciphertext || tag). */
export async function encryptText(plaintext: string, passphrase: string): Promise<string> {
  const key   = await deriveKey(passphrase)
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const enc   = new TextEncoder()
  const ct    = await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, enc.encode(plaintext))
  const out   = new Uint8Array(nonce.byteLength + ct.byteLength)
  out.set(nonce, 0)
  out.set(new Uint8Array(ct), nonce.byteLength)
  return btoa(String.fromCharCode(...out)).replace(/\+/g, "-").replace(/\//g, "_")
}

/** Decrypt base64url payload back to plaintext. */
export async function decryptText(encoded: string, passphrase: string): Promise<string> {
  const b64    = encoded.replace(/-/g, "+").replace(/_/g, "/")
  const buf    = Uint8Array.from(atob(b64), c => c.charCodeAt(0))
  const key    = await deriveKey(passphrase)
  const nonce  = buf.slice(0, 12)
  const ct     = buf.slice(12)
  const plain  = await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ct)
  return new TextDecoder().decode(plain)
}

// ── Cookie setup ──────────────────────────────────────────────────────────────

/**
 * saveCookies encrypts and stores Netscape cookies.
 * The encryption key is derived from the user's UID (stored in localStorage).
 * Returns the encrypted payload for confirmation.
 */
export async function saveCookies(netscapeCookies: string): Promise<string> {
  const uid = getOrCreateUID()
  // Key = uid + "_ytkey" to make it distinct but still device-local
  const passphrase = uid + "_ytkey"
  const encrypted  = await encryptText(netscapeCookies, passphrase)
  setEncryptedCookies(encrypted)
  setEncryptionKey(passphrase)
  return encrypted
}

export function removeCookies(): void {
  clearEncryptedCookies()
}

export function cookiesAreSet(): boolean {
  return hasCookies()
}

// ── Request builder ───────────────────────────────────────────────────────────

function buildPayload(extra: Record<string, string> = {}) {
  return {
    encrypted_cookies: getEncryptedCookies(),
    encryption_key:    getEncryptionKey(),
    uid:               getOrCreateUID(),
    ...extra,
  }
}

async function postYTData<T>(path: string, extra: Record<string, string> = {}): Promise<T> {
  if (!YTDATA_URL) throw new Error("NEXT_PUBLIC_YTDATA_URL not set")
  if (!hasCookies()) throw new Error("No YouTube cookies configured")

  const res = await fetch(YTDATA_URL + path, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(buildPayload(extra)),
    signal:  AbortSignal.timeout(20_000),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error ?? `ytdata ${res.status}`)
  }

  return res.json() as Promise<T>
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Personalised YTM home feed. */
export function getYTHome(): Promise<YTHomeFeed> {
  return postYTData<YTHomeFeed>("/home")
}

/** YTM Explore / new releases. */
export function getYTExplore(): Promise<YTHomeFeed> {
  return postYTData<YTHomeFeed>("/explore")
}

/** YTM Trending. */
export function getYTTrending(): Promise<YTHomeFeed> {
  return postYTData<YTHomeFeed>("/trending")
}

/** YouTube listening history. */
export function getYTHistory(): Promise<{ items: YTSongItem[] }> {
  return postYTData<{ items: YTSongItem[] }>("/history")
}

/** Liked songs on YouTube. */
export function getYTLiked(): Promise<{ items: YTSongItem[] }> {
  return postYTData<{ items: YTSongItem[] }>("/liked")
}

/** Related songs for a videoId. */
export function getYTRelated(videoId: string): Promise<{ raw: unknown }> {
  return postYTData("/related", { video_id: videoId })
}

/**
 * Record a play event back to YouTube.
 * Fire-and-forget — call this when a song starts playing.
 */
export function recordYTPlay(videoId: string): void {
  if (!hasCookies() || !YTDATA_URL) return
  fetch(YTDATA_URL + "/record_play", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ ...buildPayload(), video_id: videoId }),
    keepalive: true,
  }).catch(() => {}) // fire and forget
}

/** Convert YTSongItem to the app's Song type. */
export function ytItemToSong(item: YTSongItem) {
  return {
    id:        item.videoId,
    videoId:   item.videoId,
    title:     item.title,
    artist:    item.artist,
    thumbnail: item.thumbnail,
    album:     item.album,
    duration:  item.duration,
    type:      "musiva" as const,
  }
}
