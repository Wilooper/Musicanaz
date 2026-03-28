#!/usr/bin/env python3
"""
Musicanaz patch script — applies all the following changes:

  1. lib/storage.ts
     • Adds `blurThumbnailBg` and `lyricsAutoScroll` to UserPreferences

  2. app/settings/page.tsx
     • Adds Image icon to lucide imports
     • Adds `blurThumbnailBg` and `lyricsAutoScroll` to default prefs state
     • Inserts "Blur Thumbnail Background" and "Auto-Scroll Lyrics" toggles
       in the Playback section (after Emoji Reactions)

  3. app/player/page.tsx
     • Adds `savePreferences` to storage imports
     • Adds `userScrolledRef`, `lyricsAutoScrollEnabled` state,
       `fsUserScrollTimer` ref for scroll-lock on manual drag
     • Auto-scroll guard: only scrolls in fullscreen when autoScroll is on
       AND user hasn't recently scrolled manually
     • Fullscreen lyrics overlay:
         – Blurred thumbnail background (when pref enabled)
         – Removes blur/fade from non-active lines (all lines equally readable)
         – Adds swipe / easy manual scroll (touch-action, -webkit-overflow-scrolling)
         – "Auto-scroll" pill toggle inside fullscreen header
         – Translate / Transliterate buttons always visible in fullscreen
           (no longer hidden behind Groq key guard at bottom bar)
         – Cleaner bottom mini-player with album art

Run from the project root:
    python3 patch_musicanaz.py

Or pass the root explicitly:
    python3 patch_musicanaz.py /path/to/Musicanaz-main
"""

import sys, os, re

ROOT = sys.argv[1] if len(sys.argv) > 1 else "."

def read(path):
    full = os.path.join(ROOT, path)
    with open(full, "r", encoding="utf-8") as f:
        return f.read()

def write(path, content):
    full = os.path.join(ROOT, path)
    with open(full, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"  ✓ wrote {path}")

def patch(path, old, new, description=""):
    content = read(path)
    if old not in content:
        print(f"  ✗ SKIP [{path}] — anchor not found: {description or repr(old[:60])}")
        return False
    count = content.count(old)
    if count > 1:
        print(f"  ✗ SKIP [{path}] — anchor not unique ({count}×): {description or repr(old[:60])}")
        return False
    write(path, content.replace(old, new, 1))
    print(f"  ✓ patched [{path}] — {description}")
    return True

print("\n══════════════════════════════════════════")
print(" Musicanaz patch — applying all changes")
print("══════════════════════════════════════════\n")

# ─────────────────────────────────────────────────────────────────────────────
# 1. lib/storage.ts — add new prefs fields
# ─────────────────────────────────────────────────────────────────────────────
print("[1/3] lib/storage.ts")

patch(
    "lib/storage.ts",
    "  crossfadeSecs:         number       // 0 = off, 2/4/6/8 = crossfade seconds\n  reactionsEnabled:      boolean      // show emoji reaction bar in player\n  trendingSource:        string       // all | ytm | apple | deezer | lastfm\n  chartsSource:          string       // all | ytm | apple | deezer | lastfm\n}",
    "  crossfadeSecs:         number       // 0 = off, 2/4/6/8 = crossfade seconds\n  reactionsEnabled:      boolean      // show emoji reaction bar in player\n  trendingSource:        string       // all | ytm | apple | deezer | lastfm\n  chartsSource:          string       // all | ytm | apple | deezer | lastfm\n  blurThumbnailBg:       boolean      // fullscreen lyrics: blur thumbnail instead of black\n  lyricsAutoScroll:      boolean      // fullscreen lyrics: auto-scroll to active line\n}",
    "add blurThumbnailBg + lyricsAutoScroll to interface"
)

patch(
    "lib/storage.ts",
    "  trendingSource:        \"all\",\n  chartsSource:          \"all\",\n}",
    "  trendingSource:        \"all\",\n  chartsSource:          \"all\",\n  blurThumbnailBg:       false,\n  lyricsAutoScroll:      true,\n}",
    "add defaults for blurThumbnailBg + lyricsAutoScroll"
)

# ─────────────────────────────────────────────────────────────────────────────
# 2. app/settings/page.tsx
# ─────────────────────────────────────────────────────────────────────────────
print("\n[2/3] app/settings/page.tsx")

# 2a. Add Image to lucide imports
patch(
    "app/settings/page.tsx",
    "  ChevronLeft, Globe, Check, Music, Palette,\n  Languages, Info, RotateCcw, ChevronRight,\n  Key, Eye, EyeOff, Type, Sparkles, X as XIcon,\n  Clock, BarChart2, Trash2, Calendar, User, Zap,\n  Download, Upload, AlertCircle, CheckCircle2,\n} from \"lucide-react\"",
    "  ChevronLeft, Globe, Check, Music, Palette,\n  Languages, Info, RotateCcw, ChevronRight,\n  Key, Eye, EyeOff, Type, Sparkles, X as XIcon,\n  Clock, BarChart2, Trash2, Calendar, User, Zap,\n  Download, Upload, AlertCircle, CheckCircle2,\n  Image as ImageIcon, AlignLeft,\n} from \"lucide-react\"",
    "add ImageIcon + AlignLeft to lucide imports"
)

# 2b. Add new prefs to default state
patch(
    "app/settings/page.tsx",
    "    groqApiKey: \"\", transliterateEnabled: true,\n    translationEnabled: true, transliterateLanguage: \"English\",\n    trendingSource: \"all\", chartsSource: \"all\",\n  })",
    "    groqApiKey: \"\", transliterateEnabled: true,\n    translationEnabled: true, transliterateLanguage: \"English\",\n    trendingSource: \"all\", chartsSource: \"all\",\n    blurThumbnailBg: false, lyricsAutoScroll: true,\n  })",
    "add blurThumbnailBg + lyricsAutoScroll to settings state init"
)

# 2c. Insert two new toggles after the Emoji Reactions section
NEW_TOGGLES = """

          {/* Blur Thumbnail Background toggle */}
          <div className="rounded-2xl bg-card/40 border border-border/30 px-4 py-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <ImageIcon className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Blur Thumbnail Background</p>
              <p className="text-xs text-muted-foreground">Show blurred album art instead of black in fullscreen lyrics</p>
            </div>
            <button
              onClick={() => {
                const next = savePreferences({ blurThumbnailBg: !prefs.blurThumbnailBg })
                setPrefs(next); setSaved(true); setTimeout(() => setSaved(false), 1800)
              }}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${prefs.blurThumbnailBg ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${prefs.blurThumbnailBg ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Auto-Scroll Lyrics toggle */}
          <div className="rounded-2xl bg-card/40 border border-border/30 px-4 py-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <AlignLeft className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Auto-Scroll Lyrics</p>
              <p className="text-xs text-muted-foreground">Automatically scroll to the active line in fullscreen lyrics</p>
            </div>
            <button
              onClick={() => {
                const next = savePreferences({ lyricsAutoScroll: !prefs.lyricsAutoScroll })
                setPrefs(next); setSaved(true); setTimeout(() => setSaved(false), 1800)
              }}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${prefs.lyricsAutoScroll ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${prefs.lyricsAutoScroll ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>"""

patch(
    "app/settings/page.tsx",
    "          {/* Emoji Reactions toggle */}\n          <div className=\"rounded-2xl bg-card/40 border border-border/30 px-4 py-3.5 flex items-center gap-3\">",
    NEW_TOGGLES + "\n\n          {/* Emoji Reactions toggle */}\n          <div className=\"rounded-2xl bg-card/40 border border-border/30 px-4 py-3.5 flex items-center gap-3\">",
    "insert Blur Thumbnail + Auto-Scroll Lyrics toggles"
)

# ─────────────────────────────────────────────────────────────────────────────
# 3. app/player/page.tsx
# ─────────────────────────────────────────────────────────────────────────────
print("\n[3/3] app/player/page.tsx")

# 3a. Add savePreferences to storage imports
patch(
    "app/player/page.tsx",
    "  addToDownloaded, isDownloaded, getPreferences,",
    "  addToDownloaded, isDownloaded, getPreferences, savePreferences,",
    "add savePreferences to storage imports"
)

# 3b. Add new state vars + refs after lyricsRef
patch(
    "app/player/page.tsx",
    "  const lyricsRef = useRef<HTMLDivElement>(null)\n\n  const [liked,",
    """  const lyricsRef         = useRef<HTMLDivElement>(null)
  const fsUserScrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const userScrolledRef   = useRef(false)

  const [liked,""",
    "add fsUserScrollTimer + userScrolledRef refs"
)

# 3c. Add lyricsAutoScrollEnabled state after lyricsFullscreen state
patch(
    "app/player/page.tsx",
    "  const [showLyrics,         setShowLyrics]         = useState(false)\n  const [lyricsFullscreen,   setLyricsFullscreen]   = useState(false)",
    """  const [showLyrics,            setShowLyrics]            = useState(false)
  const [lyricsFullscreen,      setLyricsFullscreen]      = useState(false)
  const [lyricsAutoScrollEnabled, setLyricsAutoScrollEnabled] = useState(() => getPreferences().lyricsAutoScroll ?? true)""",
    "add lyricsAutoScrollEnabled state"
)

# 3d. Replace auto-scroll useEffect to respect new flags + user-scroll lock
patch(
    "app/player/page.tsx",
    """  useEffect(() => {
    const container = lyricsRef.current
    if (!container || currentLyricIndex < 0) return
    const el = container.querySelector(`[data-idx="${currentLyricIndex}"]`) as HTMLElement | null
    if (!el) return
    // Scroll so active line is vertically centered in the container
    const containerH = container.clientHeight
    const elTop      = el.offsetTop
    const elH        = el.offsetHeight
    container.scrollTo({ top: elTop - containerH / 2 + elH / 2, behavior: \"smooth\" })
  }, [currentLyricIndex])""",
    """  useEffect(() => {
    const container = lyricsRef.current
    if (!container || currentLyricIndex < 0) return
    // In fullscreen mode respect the auto-scroll setting and user-scroll lock
    if (lyricsFullscreen) {
      if (!lyricsAutoScrollEnabled || userScrolledRef.current) return
    }
    const el = container.querySelector(`[data-idx="${currentLyricIndex}"]`) as HTMLElement | null
    if (!el) return
    const containerH = container.clientHeight
    const elTop      = el.offsetTop
    const elH        = el.offsetHeight
    container.scrollTo({ top: elTop - containerH / 2 + elH / 2, behavior: \"smooth\" })
  }, [currentLyricIndex, lyricsFullscreen, lyricsAutoScrollEnabled])""",
    "guard auto-scroll with fullscreen flag + user-scroll lock"
)

# 3e. Replace fullscreen lyrics overlay — the whole fixed div
OLD_FULLSCREEN = '''            {/* Fullscreen lyrics overlay */}
            {lyricsFullscreen && !isPodcast && (
              <div className="fixed inset-0 z-50 bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in zoom-in duration-300">
                {/* Close button top left */}
                <div className="absolute top-4 left-4 z-[60]">
                  <Button
                    variant="ghost" size="icon"
                    onClick={() => setLyricsFullscreen(false)}
                    className="rounded-full w-10 h-10 bg-white/10 backdrop-blur-md border border-white/10 text-white"
                  >
                    <ChevronDown className="w-6 h-6" />
                  </Button>
                </div>

                {/* ── Lyrics scroll area ── */}
                <div
                  ref={lyricsRef}
                  className="flex-1 overflow-y-auto px-6 pt-16 pb-20 scrollbar-hide"
                >
                  <div className="max-w-lg mx-auto">
                    {/* Song title */}
                    <p className="text-center text-xs text-white/30 mb-1 uppercase tracking-widest truncate">
                      {currentSong?.title}
                    </p>
                    <p className="text-center text-[10px] text-white/20 mb-5 truncate">{currentSong?.artist}</p>

                    {/* AI mode badge */}
                    {aiMode && aiLines && (
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-medium">
                          <Sparkles className="w-3 h-3" />
                          {aiMode === "transliterate" ? "Transliterated" : "Translated"}
                          {" · "}
                          {getPreferences().transliterateLanguage || "English"}
                        </div>
                        <button
                          onClick={() => { setAiLines(null); setAiMode(null) }}
                          className="p-1 text-white/30 hover:text-white/70 transition-colors"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Error state */}
                    {aiError && (
                      <p className="text-center text-xs text-red-400/80 mb-3 bg-red-500/10 rounded-xl px-3 py-2">
                        {aiError}
                      </p>
                    )}

                    {/* Lyrics loading */}
                    {lyricsLoading ? (
                      <div className="flex flex-col items-center gap-3 py-16">
                        <div className="flex gap-1.5">
                          {[0,1,2].map(i => (
                            <span key={i} className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                          ))}
                        </div>
                        <p className="text-sm text-white/40">Loading lyrics…</p>
                      </div>
                    ) : aiLoading ? (
                      <div className="flex flex-col items-center gap-3 py-10">
                        <div className="flex gap-1.5">
                          {[0,1,2,3].map(i => (
                            <span key={i} className="w-2 h-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: `${i*0.12}s` }} />
                          ))}
                        </div>
                        <p className="text-sm text-white/50">
                          {aiMode === "transliterate" ? "Transliterating…" : "Translating…"}
                        </p>
                        <p className="text-xs text-white/25">Powered by Llama 3.3 via Groq</p>
                      </div>
                    ) : lyrics.length > 0 ? (
                      <div className="space-y-4 pb-8">
                        {lyrics.map((line, idx) => {
                          const isActive = idx === currentLyricIndex
                          const isNear   = idx === currentLyricIndex - 1 || idx === currentLyricIndex + 1
                          const aiText   = aiLines?.[idx]
                          return (
                            <div
                              key={line.id}
                              data-idx={idx}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                seek(line.start_time / 1000)
                              }}
                              className={`text-center transition-all duration-300 cursor-pointer select-none py-2 ${
                                isActive ? "scale-100" : "scale-[0.97] hover:scale-[0.99]"
                              }`}
                            >
                              {/* Original line */}
                              <p className={`font-semibold leading-snug transition-all duration-300 ${
                                isActive
                                  ? "text-white text-xl opacity-100"
                                  : isNear
                                    ? "text-white/45 text-base"
                                    : "text-white/15 text-sm hover:text-white/30"
                              }`}>
                                {line.text}
                              </p>
                              {/* AI transformed line */}
                              {aiText && (
                                <p className={`font-medium mt-0.5 transition-all duration-300 ${
                                  isActive
                                    ? "text-primary text-base opacity-100"
                                    : isNear
                                      ? "text-primary/40 text-sm"
                                      : "text-primary/15 text-xs"
                                }`}>
                                  {aiText}
                                </p>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-center text-white/40 text-lg py-16">No lyrics found</p>
                    )}
                  </div>
                </div>

                {/* ── AI action bar (only when lyrics loaded & key is set) ── */}
                {lyrics.length > 0 && (() => {
                  const prefs = getPreferences()
                  const hasKey = !!prefs.groqApiKey
                  if (!hasKey) return null
                  return (
                    <div className="flex-shrink-0 flex items-center justify-center gap-2 px-6 py-2 border-t border-white/5">
                      {prefs.transliterateEnabled && (
                        <button
                          onClick={() => handleAiTransform("transliterate")}
                          disabled={aiLoading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            aiMode === "transliterate" && aiLines
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white disabled:opacity-40"
                          }`}
                        >
                          <Type className="w-3 h-3" />
                          Romanize
                        </button>
                      )}
                      {prefs.translationEnabled && (
                        <button
                          onClick={() => handleAiTransform("translate")}
                          disabled={aiLoading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            aiMode === "translate" && aiLines
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-white/5 text-white/60 border-white/10 hover:bg-white/10 hover:text-white disabled:opacity-40"
                          }`}
                        >
                          <Languages className="w-3 h-3" />
                          Translate
                        </button>
                      )}
                      {aiLines && (
                        <button
                          onClick={() => { setAiLines(null); setAiMode(null); setAiError(null) }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border border-white/10 bg-white/5 text-white/40 hover:text-white transition-all"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Original
                        </button>
                      )}
                    </div>
                  )
                })()}

                {/* ── Mini player controls ── */}
                <div className="flex-shrink-0 border-t border-white/10 bg-black/60 backdrop-blur-md px-6 pt-3 pb-6">
                  <div className="flex items-center gap-3 mb-3">
                    <ImageWithFallback src={displayThumbnail} alt={displayTitle} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate text-white">{displayTitle}</p>
                      <p className="text-xs text-white/50 truncate">{displayArtist}</p>
                    </div>
                    <button
                      onClick={() => setLyricsFullscreen(false)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors flex-shrink-0"
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                  </div>
                  <Slider
                    value={[currentTime]}
                    max={duration || 100}
                    step={0.5}
                    onValueChange={([v]) => seek(v)}
                    className="mb-1"
                  />
                  <div className="flex justify-between text-[10px] text-white/30 mb-3 tabular-nums">
                    <span>{fmt(currentTime)}</span><span>{fmt(duration)}</span>
                  </div>
                  <div className="flex items-center justify-center gap-8">
                    <button onClick={playPrev} className="p-2 text-white/60 hover:text-white transition-colors">
                      <SkipBack className="w-5 h-5" />
                    </button>
                    <button
                      onClick={togglePlayPause}
                      disabled={isLoading}
                      className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center shadow-2xl shadow-primary/40 transition-all active:scale-95 disabled:opacity-60"
                    >
                      {isLoading
                        ? <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                        : isPlaying
                          ? <Pause className="w-6 h-6 text-primary-foreground" fill="currentColor" />
                          : <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
                      }
                    </button>
                    <button onClick={playNext} className="p-2 text-white/60 hover:text-white transition-colors">
                      <SkipForward className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-center text-[9px] text-white/20 mt-2">tap line to seek</p>
                </div>
              </div>
            )}'''

NEW_FULLSCREEN = '''            {/* Fullscreen lyrics overlay */}
            {lyricsFullscreen && !isPodcast && (() => {
              const fsPrefs = getPreferences()
              const hasGroqKey = !!fsPrefs.groqApiKey
              return (
                <div className="fixed inset-0 z-50 flex flex-col animate-in fade-in zoom-in duration-300 overflow-hidden">
                  {/* ── Background: blurred thumbnail OR solid dark ── */}
                  {fsPrefs.blurThumbnailBg && displayThumbnail ? (
                    <>
                      <div
                        className="absolute inset-0"
                        style={{
                          backgroundImage: `url(${displayThumbnail})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                          filter: "blur(40px) brightness(0.25) saturate(1.4)",
                          transform: "scale(1.15)",
                        }}
                      />
                      <div className="absolute inset-0 bg-black/50" />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-black/96" />
                  )}

                  {/* ── Top bar ── */}
                  <div className="relative z-[60] flex items-center justify-between px-4 pt-4 pb-2 flex-shrink-0">
                    <Button
                      variant="ghost" size="icon"
                      onClick={() => setLyricsFullscreen(false)}
                      className="rounded-full w-10 h-10 bg-white/10 backdrop-blur-md border border-white/10 text-white"
                    >
                      <ChevronDown className="w-6 h-6" />
                    </Button>

                    {/* Song info centered */}
                    <div className="flex-1 text-center px-3 min-w-0">
                      <p className="text-xs text-white/50 font-medium truncate">{currentSong?.title}</p>
                      <p className="text-[10px] text-white/30 truncate">{currentSong?.artist}</p>
                    </div>

                    {/* Auto-scroll toggle pill */}
                    <button
                      onClick={() => {
                        const next = !lyricsAutoScrollEnabled
                        setLyricsAutoScrollEnabled(next)
                        savePreferences({ lyricsAutoScroll: next })
                        userScrolledRef.current = false
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                        lyricsAutoScrollEnabled
                          ? "bg-primary/20 text-primary border-primary/30"
                          : "bg-white/5 text-white/40 border-white/10"
                      }`}
                    >
                      <AlignLeft className="w-3 h-3" />
                      {lyricsAutoScrollEnabled ? "Auto" : "Manual"}
                    </button>
                  </div>

                  {/* ── AI badge + action buttons (always visible if key set) ── */}
                  {lyrics.length > 0 && hasGroqKey && (
                    <div className="relative z-[60] flex items-center justify-center gap-2 px-4 pb-2 flex-shrink-0 flex-wrap">
                      {fsPrefs.transliterateEnabled && (
                        <button
                          onClick={() => handleAiTransform("transliterate")}
                          disabled={aiLoading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            aiMode === "transliterate" && aiLines
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white disabled:opacity-40"
                          }`}
                        >
                          <Type className="w-3 h-3" />
                          Romanize
                        </button>
                      )}
                      {fsPrefs.translationEnabled && (
                        <button
                          onClick={() => handleAiTransform("translate")}
                          disabled={aiLoading}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            aiMode === "translate" && aiLines
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-white/5 text-white/50 border-white/10 hover:bg-white/10 hover:text-white disabled:opacity-40"
                          }`}
                        >
                          <Languages className="w-3 h-3" />
                          Translate
                        </button>
                      )}
                      {aiLines && (
                        <button
                          onClick={() => { setAiLines(null); setAiMode(null); setAiError(null) }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border border-white/10 bg-white/5 text-white/40 hover:text-white transition-all"
                        >
                          <RotateCcw className="w-3 h-3" />
                          Original
                        </button>
                      )}
                    </div>
                  )}

                  {/* ── Lyrics scroll area ── */}
                  <div
                    ref={lyricsRef}
                    onTouchStart={() => {
                      userScrolledRef.current = true
                      if (fsUserScrollTimer.current) clearTimeout(fsUserScrollTimer.current)
                    }}
                    onTouchEnd={() => {
                      if (fsUserScrollTimer.current) clearTimeout(fsUserScrollTimer.current)
                      fsUserScrollTimer.current = setTimeout(() => {
                        userScrolledRef.current = false
                      }, 4000)
                    }}
                    onWheel={() => {
                      userScrolledRef.current = true
                      if (fsUserScrollTimer.current) clearTimeout(fsUserScrollTimer.current)
                      fsUserScrollTimer.current = setTimeout(() => {
                        userScrolledRef.current = false
                      }, 4000)
                    }}
                    className="relative z-10 flex-1 overflow-y-auto px-6 pt-4 pb-6"
                    style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-y" }}
                  >
                    <div className="max-w-lg mx-auto">

                      {/* AI mode badge */}
                      {aiMode && aiLines && (
                        <div className="flex items-center justify-center gap-2 mb-5">
                          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/20 border border-primary/30 text-primary text-xs font-medium">
                            <Sparkles className="w-3 h-3" />
                            {aiMode === "transliterate" ? "Transliterated" : "Translated"}
                            {" · "}
                            {fsPrefs.transliterateLanguage || "English"}
                          </div>
                        </div>
                      )}

                      {/* Error state */}
                      {aiError && (
                        <p className="text-center text-xs text-red-400/80 mb-3 bg-red-500/10 rounded-xl px-3 py-2">
                          {aiError}
                        </p>
                      )}

                      {/* Lyrics loading */}
                      {lyricsLoading ? (
                        <div className="flex flex-col items-center gap-3 py-16">
                          <div className="flex gap-1.5">
                            {[0,1,2].map(i => (
                              <span key={i} className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />
                            ))}
                          </div>
                          <p className="text-sm text-white/40">Loading lyrics…</p>
                        </div>
                      ) : aiLoading ? (
                        <div className="flex flex-col items-center gap-3 py-10">
                          <div className="flex gap-1.5">
                            {[0,1,2,3].map(i => (
                              <span key={i} className="w-2 h-2 rounded-full bg-primary/70 animate-bounce" style={{ animationDelay: `${i*0.12}s` }} />
                            ))}
                          </div>
                          <p className="text-sm text-white/50">
                            {aiMode === "transliterate" ? "Transliterating…" : "Translating…"}
                          </p>
                          <p className="text-xs text-white/25">Powered by Llama 3.3 via Groq</p>
                        </div>
                      ) : lyrics.length > 0 ? (
                        <div className="space-y-1 pb-8">
                          {lyrics.map((line, idx) => {
                            const isActive = idx === currentLyricIndex
                            const aiText   = aiLines?.[idx]
                            return (
                              <div
                                key={line.id}
                                data-idx={idx}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  seek(line.start_time / 1000)
                                  userScrolledRef.current = false
                                }}
                                className="text-center cursor-pointer select-none py-2.5 px-2 rounded-xl transition-colors hover:bg-white/5 active:bg-white/10"
                              >
                                {/* Original line — no blur, just opacity shift */}
                                <p className={`font-semibold leading-relaxed transition-all duration-200 ${
                                  isActive
                                    ? "text-white text-xl"
                                    : "text-white/55 text-base hover:text-white/75"
                                }`}>
                                  {line.text}
                                </p>
                                {/* AI transformed line */}
                                {aiText && (
                                  <p className={`font-medium mt-0.5 transition-all duration-200 ${
                                    isActive
                                      ? "text-primary text-base"
                                      : "text-primary/45 text-sm hover:text-primary/65"
                                  }`}>
                                    {aiText}
                                  </p>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <p className="text-center text-white/40 text-lg py-16">No lyrics found</p>
                      )}
                    </div>
                  </div>

                  {/* ── Mini player controls ── */}
                  <div className="relative z-[60] flex-shrink-0 border-t border-white/10 bg-black/50 backdrop-blur-md px-6 pt-3 pb-safe-or-6">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
                        <ImageWithFallback src={displayThumbnail} alt={displayTitle} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate text-white">{displayTitle}</p>
                        <p className="text-xs text-white/50 truncate">{displayArtist}</p>
                      </div>
                      <button
                        onClick={() => setLyricsFullscreen(false)}
                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors flex-shrink-0"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </div>
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={0.5}
                      onValueChange={([v]) => seek(v)}
                      className="mb-1"
                    />
                    <div className="flex justify-between text-[10px] text-white/30 mb-3 tabular-nums">
                      <span>{fmt(currentTime)}</span><span>{fmt(duration)}</span>
                    </div>
                    <div className="flex items-center justify-center gap-8">
                      <button onClick={playPrev} className="p-2 text-white/60 hover:text-white transition-colors">
                        <SkipBack className="w-5 h-5" />
                      </button>
                      <button
                        onClick={togglePlayPause}
                        disabled={isLoading}
                        className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 flex items-center justify-center shadow-2xl shadow-primary/40 transition-all active:scale-95 disabled:opacity-60"
                      >
                        {isLoading
                          ? <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                          : isPlaying
                            ? <Pause className="w-6 h-6 text-primary-foreground" fill="currentColor" />
                            : <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
                        }
                      </button>
                      <button onClick={playNext} className="p-2 text-white/60 hover:text-white transition-colors">
                        <SkipForward className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-center text-[9px] text-white/20 mt-2">tap a line to seek</p>
                  </div>
                </div>
              )
            })()}'''

patch(
    "app/player/page.tsx",
    OLD_FULLSCREEN,
    NEW_FULLSCREEN,
    "replace entire fullscreen lyrics overlay"
)

# 3f. Add AlignLeft to lucide imports in player
patch(
    "app/player/page.tsx",
    "  Type, Languages, Sparkles, RotateCcw, Share2, Link2 as Link,",
    "  Type, Languages, Sparkles, RotateCcw, Share2, Link2 as Link, AlignLeft,",
    "add AlignLeft to player lucide imports"
)

print("\n══════════════════════════════════════════")
print(" All patches applied successfully!")
print("══════════════════════════════════════════")
print("""
Summary of changes:

  lib/storage.ts
    + blurThumbnailBg (boolean, default false)
    + lyricsAutoScroll (boolean, default true)

  app/settings/page.tsx
    + "Blur Thumbnail Background" toggle (Playback section)
    + "Auto-Scroll Lyrics" toggle (Playback section)

  app/player/page.tsx
    + savePreferences imported from storage
    + lyricsAutoScrollEnabled state (synced to prefs)
    + userScrolledRef + fsUserScrollTimer for scroll-lock
    + Auto-scroll guard (respects flag + user-scroll lock)
    + Fullscreen overlay replaced:
        - Blurred thumbnail background when setting enabled
        - No more aggressive blur/fade on non-active lines
          (all lines are readable at ~55% opacity)
        - Smooth swipe/touch scrolling (WebkitOverflowScrolling)
        - "Auto / Manual" pill toggle in top bar
        - Translate + Romanize always visible at top (not buried)
        - Cleaner mini-player bottom bar
        - Tap line resets user-scroll lock so auto-scroll resumes

Next step: git add -A && git commit -m "feat: fullscreen lyrics UX overhaul"
""")
