#!/usr/bin/env python3
import pathlib, sys
if not pathlib.Path("package.json").exists():
    sys.exit("Run from Musicanaz root")

# ── yt-client.ts: send cookies as base64 (no encryption needed) ──────────────
pathlib.Path("lib/yt-client.ts").write_text('''\
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
''')
print("✓ lib/yt-client.ts")

# ── YTCookiesPanel: update instructions for music.youtube.com ─────────────────
pathlib.Path("components/yt-cookies-panel.tsx").write_text('''\
"use client"

import { useState, useEffect } from "react"
import { saveCookies, removeCookies, cookiesAreSet } from "@/lib/yt-client"
import { Button } from "@/components/ui/button"
import { CheckCircle2, Trash2, Cookie, ChevronDown, ChevronUp } from "lucide-react"

export function YTCookiesPanel() {
  const [connected, setConnected] = useState(false)
  const [text,      setText]      = useState("")
  const [saving,    setSaving]    = useState(false)
  const [showHow,   setShowHow]   = useState(false)
  const [msg,       setMsg]       = useState("")

  useEffect(() => { setConnected(cookiesAreSet()) }, [])

  function handleSave() {
    const t = text.trim()
    if (!t) { setMsg("Paste your cookies first."); return }
    if (!t.includes("SAPISID") && !t.includes("music.youtube.com") && !t.includes("youtube.com")) {
      setMsg("Doesn\'t look like YouTube Music cookies. Make sure you export from music.youtube.com.")
      return
    }
    setSaving(true)
    try {
      saveCookies(t)
      setConnected(true)
      setText("")
      setMsg("Connected! Go to Home to see your personalised feed.")
    } catch (e: any) {
      setMsg("Error: " + (e?.message ?? "unknown"))
    } finally {
      setSaving(false)
    }
  }

  function handleRemove() {
    removeCookies()
    setConnected(false)
    setText("")
    setMsg("Disconnected.")
  }

  return (
    <div className="rounded-2xl border border-border bg-card text-card-foreground overflow-hidden mb-3">
      <div className="flex items-center gap-3 px-4 py-3">
        <Cookie className="w-5 h-5 text-red-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-foreground">YouTube Music Account</p>
          <p className="text-xs text-muted-foreground">
            {connected ? "✓ Account connected — personalised feed active" : "Not connected"}
          </p>
        </div>
        {connected && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
      </div>

      <div className="border-t border-border/40 px-4 py-3 space-y-3">
        <button
          onClick={() => setShowHow(v => !v)}
          className="flex items-center gap-1 text-xs text-primary font-medium"
        >
          {showHow ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          How to get your cookies
        </button>

        {showHow && (
          <ol className="text-xs text-muted-foreground space-y-1.5 pl-4 list-decimal">
            <li>Install <strong className="text-foreground">Get cookies.txt LOCALLY</strong> extension</li>
            <li>Open <strong className="text-foreground">music.youtube.com</strong> and sign in</li>
            <li>Click the extension → <strong className="text-foreground">Export as Netscape format</strong></li>
            <li>Copy everything and paste below</li>
          </ol>
        )}

        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setMsg("") }}
          placeholder="Paste music.youtube.com Netscape cookies here..."
          rows={5}
          className="w-full rounded-lg border border-border bg-background text-foreground text-xs p-2.5 resize-none focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground font-mono"
        />

        {msg && (
          <p className={`text-xs leading-snug ${
            msg.startsWith("Connected") ? "text-green-600 dark:text-green-400" : "text-destructive"
          }`}>{msg}</p>
        )}

        <div className="flex gap-2">
          <Button
            size="sm"
            className="rounded-full flex-1"
            onClick={handleSave}
            disabled={saving || !text.trim()}
          >
            {connected ? "Update Cookies" : "Connect Account"}
          </Button>
          {connected && (
            <Button size="sm" variant="outline" className="rounded-full" onClick={handleRemove}>
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
''')
print("✓ components/yt-cookies-panel.tsx")
print("""
Done. Now:
  1. Push the HF Space files (app.py, requirements.txt, Dockerfile) to the ytmlp repo
  2. Run this in Musicanaz:
     git add lib/yt-client.ts components/yt-cookies-panel.tsx
     git commit -m "fix: ytmusicapi cookies, base64 transport"
     git push
""")
