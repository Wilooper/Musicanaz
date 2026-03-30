#!/usr/bin/env python3
"""
fix_v3.py  —  run from Musicanaz project root:

    python3 fix_v3.py

Fixes:
  1. Removes the v1 "sorted by your taste" badge by text-anchor search
     (CRLF-safe, not fooled by opening-line formatting)
  2. Injects the AI Home section (Brain icon + analysis card + recos)
     if it's missing from the JSX
  3. Removes any duplicate clean badges if present
  4. Full 20-point cross-verification
"""
import sys
from pathlib import Path

G="\033[92m"; Y="\033[93m"; R="\033[91m"; E="\033[0m"
def ok(m):   print(f"{G}  ✓ {m}{E}")
def warn(m): print(f"{Y}  ⚠ {m}{E}")

ROOT = Path.cwd()
if not (ROOT/"app"/"page.tsx").exists():
    print(f"{R}Run from Musicanaz project root.{E}"); sys.exit(1)

print(f"\n🔧  Musicanaz Fix v3 (text-anchor + AI home)\n{'─'*46}")

def read_norm(path):
    raw = path.read_bytes()
    had_crlf = b'\r\n' in raw
    return raw.decode('utf-8').replace('\r\n', '\n'), had_crlf

def write_back(path, text, had_crlf):
    if had_crlf:
        text = text.replace('\n', '\r\n')
    path.write_bytes(text.encode('utf-8'))

# ═══════════════════════════════════════════════════════════════════
# 1. app/page.tsx
# ═══════════════════════════════════════════════════════════════════
p = ROOT/"app"/"page.tsx"
t, had_crlf = read_norm(p)
print(f"  Encoding: {'CRLF' if had_crlf else 'LF'}")
lines = t.split('\n')

# ── 1a. Remove v1 "sorted by your taste" badge by text-anchor ──────
removed_sorted = False
if '· sorted by your taste' in t:
    new_lines = []
    i = 0
    while i < len(lines):
        if '· sorted by your taste' in lines[i]:
            # Walk backward from here to find the opening {aiEnabled line
            start = i
            while start > 0 and '{aiEnabled' not in lines[start]:
                start -= 1
            # Walk forward to find the closing )}
            end = i
            while end < len(lines):
                stripped = lines[end].strip()
                if stripped == ')}' or stripped == ')},':
                    break
                end += 1
            # Remove lines[start..end] inclusive, plus any blank lines after
            while end + 1 < len(lines) and lines[end + 1].strip() == '':
                end += 1
            # Rebuild: everything before start + everything after end
            new_lines = lines[:start] + lines[end + 1:]
            removed_sorted = True
            ok(f"Removed v1 'sorted by your taste' badge (lines {start}–{end})")
            break
        i += 1
    if removed_sorted:
        lines = new_lines
        t = '\n'.join(lines)
else:
    ok("No 'sorted by your taste' badge found (already clean)")

# ── 1b. Remove duplicate clean badges (keep only one) ──────────────
CLEAN_BADGE_TEXT = '· ranked by your taste'
badge_positions = [i for i, l in enumerate(lines) if CLEAN_BADGE_TEXT in l]
if len(badge_positions) > 1:
    # Keep the last one, remove all earlier ones
    for pos in badge_positions[:-1]:
        start = pos
        while start > 0 and '{aiEnabled' not in lines[start]:
            start -= 1
        end = pos
        while end < len(lines):
            if lines[end].strip() in (')}', ')},'):
                break
            end += 1
        lines = lines[:start] + lines[end + 1:]
    t = '\n'.join(lines)
    ok(f"Removed {len(badge_positions)-1} duplicate clean badge(s)")
elif len(badge_positions) == 1:
    ok("Clean badge present exactly once")
else:
    ok("No clean badge yet — will insert below")

# Re-split after potential removals
lines = t.split('\n')

# ── 1c. Ensure exactly one clean badge before {renderResults()} ────
RENDER = '            {renderResults()}'
CLEAN_BADGE = (
    '\n            {aiEnabled && aiSearchBadge && activeFilter === "songs" && (\n'
    '              <div className="flex items-center gap-1.5 mb-3 text-xs text-primary">\n'
    '                <Sparkles className="w-3 h-3" />\n'
    '                <span className="font-medium">Personalised for you</span>\n'
    '                <span className="text-muted-foreground ml-1">· ranked by your taste</span>\n'
    '              </div>\n'
    '            )}\n'
)
t = '\n'.join(lines)
if CLEAN_BADGE_TEXT not in t and RENDER in t:
    t = t.replace(RENDER, CLEAN_BADGE + RENDER)
    ok("Inserted single clean badge before {renderResults()}")
elif CLEAN_BADGE_TEXT in t:
    ok("Clean badge confirmed present")

# ── 1d. Brain icon in lucide import ───────────────────────────────
if 'Brain' not in t:
    for old, new in [
        ('  Sparkles, Zap,\n} from "lucide-react"',
         '  Sparkles, Zap, Brain,\n} from "lucide-react"'),
        ('  Sparkles,\n} from "lucide-react"',
         '  Sparkles, Zap, Brain,\n} from "lucide-react"'),
        ('  ClipboardPaste,\n} from "lucide-react"',
         '  ClipboardPaste, Sparkles, Zap, Brain,\n} from "lucide-react"'),
        ('  Play, ClipboardPaste,\n} from "lucide-react"',
         '  Play, ClipboardPaste, Sparkles, Zap, Brain,\n} from "lucide-react"'),
    ]:
        if old in t:
            t = t.replace(old, new)
            ok("Added Brain/Sparkles/Zap to lucide import")
            break

# ── 1e. AI Home section (inject if Brain not in JSX) ──────────────
AI_HOME = (
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
    '                      <p className="text-xs text-muted-foreground max-w-xs">Play a few songs then run the AI. It classifies your taste via MusicBrainz.</p>\n'
    '                      {aiAnalysisError && <p className="text-xs text-destructive">{aiAnalysisError}</p>}\n'
    '                      <button onClick={handleRunAnalysis} disabled={aiAnalyzing}\n'
    '                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50">\n'
    '                        {aiAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4"/>}\n'
    '                        {aiAnalyzing ? "Analysing\u2026" : "Run AI Analysis"}\n'
    '                      </button>\n'
    '                    </div>\n'
    '                  )}\n'
    '                  {aiAnalyzing && (\n'
    '                    <div className="flex items-center gap-3 py-3 text-muted-foreground text-sm">\n'
    '                      <Loader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0"/>\n'
    '                      <div>\n'
    '                        <p className="font-medium">Analysing your taste\u2026</p>\n'
    '                        <p className="text-xs opacity-70 mt-0.5">Classifying via MusicBrainz. Up to 60s on first run.</p>\n'
    '                      </div>\n'
    '                    </div>\n'
    '                  )}\n'
    '                  {aiAnalysis && !aiAnalyzing && (\n'
    '                    <div className="flex flex-col gap-3">\n'
    '                      <p className="text-sm text-muted-foreground leading-relaxed">{aiAnalysis.taste_summary}</p>\n'
    '                      <div className="flex flex-wrap gap-1.5">\n'
    '                        {(aiAnalysis.liked_types || []).map((type, i) => (\n'
    '                          <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-primary/15 text-primary border border-primary/25 font-medium">\u2665 {type}</span>\n'
    '                        ))}\n'
    '                        {(aiAnalysis.disliked_types || []).map((type, i) => (\n'
    '                          <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-destructive/10 text-destructive/70 border border-destructive/20">\u2715 {type}</span>\n'
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
    '                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-border/40 px-2.5 py-1 rounded-full">\n'
    '                          <Sparkles className="w-3 h-3"/>Re-analyse\n'
    '                        </button>\n'
    '                      </div>\n'
    '                    </div>\n'
    '                  )}\n'
    '                </div>\n'
    '                <div className="flex items-center gap-2 mb-3">\n'
    '                  <Sparkles className="w-4 h-4 text-primary"/>\n'
    '                  <h3 className="text-sm font-bold">Recommended for you</h3>\n'
    '                  {aiRecos.length > 0 && <span className="text-[10px] text-primary/80 bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full ml-1">AI \xb7 personalised</span>}\n'
    '                  <button onClick={loadAIRecommendations} className="ml-auto text-xs text-muted-foreground hover:text-foreground">Refresh</button>\n'
    '                </div>\n'
    '                {aiRecosLoading ? <CardGrid n={6}/>\n'
    '                  : aiRecos.length > 0 ? (\n'
    '                    <div className={GRID}>\n'
    '                      {aiRecos.slice(0,12).map((song,i) => <SongCard key={i} song={song} onPlayComplete={loadRecentlyPlayed}/>)}\n'
    '                    </div>\n'
    '                  ) : aiAnalysis ? (\n'
    '                    <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/30 border border-border/20 text-sm text-muted-foreground">\n'
    '                      <Zap className="w-4 h-4 text-primary/40 flex-shrink-0"/>\n'
    '                      <span>No recommendations yet \u2014 re-run analysis or keep listening</span>\n'
    '                    </div>\n'
    '                  ) : null}\n'
    '              </section>\n'
    '            )}\n\n'
)

# Try multiple anchors for the home section injection point
ANCHORS = [
    '            {/* Recently played */}\n            {recentlyPlayed.length > 0 && (',
    '            {/* Recently played */}\n            {recentlyPlayed.length > 0 &&(',
    '          {/* Recently played */}\n          {recentlyPlayed.length > 0 && (',
    '{/* Recently played */}',
]

if '<Brain className' not in t:
    injected = False
    for anchor in ANCHORS:
        if anchor in t:
            t = t.replace(anchor, AI_HOME + anchor, 1)
            ok(f"Injected AI home section (anchor: {repr(anchor[:40])})")
            injected = True
            break
    if not injected:
        # Last resort: find the home div
        home_anchor = '{activeView === "home" && (\n          <div>'
        if home_anchor in t:
            t = t.replace(home_anchor,
                home_anchor + '\n' + AI_HOME, 1)
            ok("Injected AI home section (home div anchor)")
            injected = True
    if not injected:
        warn("Could not auto-inject AI home section — check page.tsx manually")
else:
    ok("AI home section already present (<Brain className found)")

write_back(p, t, had_crlf)
ok("app/page.tsx saved")

# ═══════════════════════════════════════════════════════════════════
# 2. audio-context.tsx — remove stale logAIEvent
# ═══════════════════════════════════════════════════════════════════
ac = ROOT/"lib"/"audio-context.tsx"
if ac.exists():
    t2, crlf2 = read_norm(ac)
    changed = False
    for dead in [
        'import { logAIEvent } from "./ai-client"\n',
        'import { logAIEvent } from "./ai-client"',
        ('      // AI: log play event (fire-and-forget; listened_ms=0 at start)\n'
         '      if (!song.isPodcast) logAIEvent(song, 0, false, false)\n'),
    ]:
        if dead in t2:
            t2 = t2.replace(dead, '')
            changed = True
    if changed:
        write_back(ac, t2, crlf2)
        ok("audio-context.tsx — removed stale logAIEvent")
    else:
        ok("audio-context.tsx — already clean")

# ═══════════════════════════════════════════════════════════════════
# 3. Cross-verification
# ═══════════════════════════════════════════════════════════════════
print(f"\n{'─'*46}\nCross-verification:")

def chk(filepath, needle, label, must_exist=True):
    fp = ROOT/filepath
    if not fp.exists():
        warn(f"MISSING FILE: {filepath}"); return False
    text, _ = read_norm(fp)
    found = needle in text
    if found == must_exist:
        ok(label); return True
    warn(f"{'NOT FOUND' if must_exist else 'STILL PRESENT'}: {label}"); return False

results = [
    chk("app/page.tsx",
        "import { getAISearchEnabled, setAISearchEnabled, aiPersonalizedSearch, "
        "getAIRecommendations, aiSongToSong, runAIAnalysis }",
        "page.tsx: v2 AI import"),
    chk("app/page.tsx", "Brain",              "page.tsx: Brain in import"),
    chk("app/page.tsx", "const [aiEnabled,",  "page.tsx: v2 AI state"),
    chk("app/page.tsx", "handleRunAnalysis",  "page.tsx: handleRunAnalysis"),
    chk("app/page.tsx", "· ranked by your taste", "page.tsx: clean badge"),
    chk("app/page.tsx", "{renderResults()}",  "page.tsx: renderResults"),
    chk("app/page.tsx", "<Brain className",   "page.tsx: Brain in JSX"),
    # Must NOT exist
    chk("app/page.tsx", "· sorted by your taste", "page.tsx: no v1 sorted badge", False),
    chk("app/page.tsx", "!aiSearchBadge",     "page.tsx: no !aiSearchBadge", False),
    chk("app/page.tsx", "getCollabSignals",   "page.tsx: no getCollabSignals", False),
    chk("app/page.tsx", "aiCollabSignals",    "page.tsx: no aiCollabSignals", False),
    # audio-context
    chk("lib/audio-context.tsx", "localRecordPlay", "audio-context: localRecordPlay"),
    chk("lib/audio-context.tsx", "songStartRef",    "audio-context: songStartRef"),
    chk("lib/audio-context.tsx", "logAIEvent",      "audio-context: no logAIEvent", False),
    # lib files
    chk("lib/local-data.ts",  "export const APP_SIG",              "local-data.ts exists"),
    chk("lib/ai-client.ts",   "export function localRecordPlay",    "ai-client: localRecordPlay"),
    chk("lib/ai-client.ts",   "export async function runAIAnalysis","ai-client: runAIAnalysis"),
    # API routes
    chk("app/api/ai/analyze/route.ts",   "AI_API_URL", "analyze route"),
    chk("app/api/ai/recommend/route.ts", "AI_API_URL", "recommend route"),
    chk("app/api/ai/search/route.ts",    "AI_API_URL", "search route"),
]

print(f"\n{'─'*46}")
passed = sum(results)
if all(results):
    print(f"{G}✅  {passed}/20 checks passed — safe to deploy!{E}")
    print("\n  git add -A && git commit -m \"fix: sorted badge + AI home section\" && git push\n")
else:
    fails = len(results) - passed
    print(f"{Y}⚠  {fails} check(s) failed — review above.{E}\n")
