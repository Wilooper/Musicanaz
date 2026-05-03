"use client"
/**
 * components/yt-cookies-panel.tsx
 * Settings panel for YouTube cookie management.
 * Drop into settings/page.tsx like any other settings section.
 *
 * Usage:
 *   import { YTCookiesPanel } from "@/components/yt-cookies-panel"
 *   <YTCookiesPanel />
 */

import { useState, useEffect } from "react"
import { saveCookies, removeCookies, cookiesAreSet } from "@/lib/yt-client"

export function YTCookiesPanel() {
  const [hasCookies, setHasCookies] = useState(false)
  const [input, setInput]           = useState("")
  const [status, setStatus]         = useState<"idle"|"saving"|"saved"|"error">("idle")
  const [error, setError]           = useState("")
  const [showInput, setShowInput]   = useState(false)

  useEffect(() => {
    setHasCookies(cookiesAreSet())
  }, [])

  async function handleSave() {
    const trimmed = input.trim()
    if (!trimmed) { setError("Paste your Netscape cookies first."); return }
    if (!trimmed.includes("youtube.com") && !trimmed.includes("HTTP Cookie File")) {
      setError("Doesn't look like a YouTube Netscape cookie file. Make sure you're pasting the correct file.")
      return
    }
    setStatus("saving")
    setError("")
    try {
      await saveCookies(trimmed)
      setHasCookies(true)
      setStatus("saved")
      setInput("")
      setShowInput(false)
      setTimeout(() => setStatus("idle"), 3000)
    } catch (e: any) {
      setStatus("error")
      setError(e?.message ?? "Failed to save cookies")
    }
  }

  function handleRemove() {
    removeCookies()
    setHasCookies(false)
    setInput("")
    setShowInput(false)
    setStatus("idle")
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-white text-sm">YouTube Account</h3>
          <p className="text-xs text-white/50 mt-0.5">
            Paste your YouTube cookies to get personalised home feed, history, liked songs and more.
            Cookies are encrypted on your device and never stored on any server.
          </p>
        </div>
        <div className="shrink-0">
          {hasCookies ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          ) : (
            <span className="text-xs text-white/30">Not connected</span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      {!showInput && (
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setShowInput(true)}
            className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
          >
            {hasCookies ? "Update cookies" : "Add cookies"}
          </button>
          {hasCookies && (
            <button
              onClick={handleRemove}
              className="text-xs px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
            >
              Remove
            </button>
          )}
        </div>
      )}

      {/* Input area */}
      {showInput && (
        <div className="space-y-3">
          <div className="text-xs text-white/40 space-y-1.5 bg-white/5 rounded-lg p-3">
            <p className="text-white/60 font-medium">How to get your cookies:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Install the <span className="text-white/80">"Get cookies.txt LOCALLY"</span> browser extension</li>
              <li>Go to <span className="text-white/80">youtube.com</span> and make sure you're signed in</li>
              <li>Click the extension → <span className="text-white/80">Export</span> → copy all text</li>
              <li>Paste below</li>
            </ol>
          </div>

          <textarea
            value={input}
            onChange={e => { setInput(e.target.value); setError("") }}
            placeholder="# Netscape HTTP Cookie File&#10;.youtube.com	TRUE	/	TRUE	..."
            rows={6}
            className="w-full rounded-lg bg-black/40 border border-white/10 text-xs text-white/80 font-mono p-3 resize-none focus:outline-none focus:border-white/30 placeholder:text-white/20"
          />

          {error && <p className="text-xs text-red-400">{error}</p>}

          {status === "saved" && (
            <p className="text-xs text-emerald-400">✓ Cookies saved and encrypted on your device</p>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={status === "saving"}
              className="text-xs px-4 py-1.5 rounded-lg bg-white text-black font-medium hover:bg-white/90 disabled:opacity-50 transition-colors"
            >
              {status === "saving" ? "Saving…" : "Save"}
            </button>
            <button
              onClick={() => { setShowInput(false); setInput(""); setError("") }}
              className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Privacy note */}
      <p className="text-[11px] text-white/25 leading-relaxed">
        Your cookies are encrypted with AES-256-GCM using a key derived from your device ID and stored only in your browser.
        They are sent encrypted with each request and immediately discarded after use — nothing is logged on our servers.
      </p>
    </div>
  )
}
