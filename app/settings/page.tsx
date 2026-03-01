"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, Globe, Check, Music, Palette,
  Languages, Info, RotateCcw, ChevronRight,
  Key, Eye, EyeOff, Type, Sparkles, X as XIcon,
  Clock, BarChart2, Trash2, Calendar, User, Zap,
  Download, Upload, AlertCircle, CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import ImageWithFallback from "@/components/image-with-fallback"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { useAudio } from "@/lib/audio-context"
import {
  getPreferences, savePreferences, type UserPreferences,
  getTodayListenSeconds, getMonthListenSeconds, getAllTimeListenSeconds,
  getWeekListenData, fmtListenTime, clearListenStats,
  getPartyUsername, savePartyUsername,
  getHeatmapData, type HeatmapDay,
  getSongHistory, exportAllData, importAllData,
} from "@/lib/storage"

const COUNTRIES = [
  { code: "ZZ", flag: "🌍", label: "Global",        desc: "Worldwide content" },
  { code: "US", flag: "🇺🇸", label: "United States", desc: "US charts & recommendations" },
  { code: "IN", flag: "🇮🇳", label: "India",          desc: "Bollywood, regional & more" },
  { code: "GB", flag: "🇬🇧", label: "United Kingdom", desc: "UK charts & content" },
  { code: "AU", flag: "🇦🇺", label: "Australia",      desc: "AU charts & content" },
  { code: "JP", flag: "🇯🇵", label: "Japan",          desc: "J-pop, anime & more" },
  { code: "KR", flag: "🇰🇷", label: "South Korea",    desc: "K-pop & Korean music" },
  { code: "BR", flag: "🇧🇷", label: "Brazil",          desc: "Sertanejo, funk & more" },
  { code: "MX", flag: "🇲🇽", label: "Mexico",          desc: "Latin music & charts" },
  { code: "FR", flag: "🇫🇷", label: "France",          desc: "French music & charts" },
  { code: "DE", flag: "🇩🇪", label: "Germany",         desc: "German charts & content" },
  { code: "NG", flag: "🇳🇬", label: "Nigeria",         desc: "Afrobeats & African music" },
  { code: "ZA", flag: "🇿🇦", label: "South Africa",   desc: "Amapiano & SA music" },
  { code: "PH", flag: "🇵🇭", label: "Philippines",    desc: "OPM & Filipino music" },
  { code: "ID", flag: "🇮🇩", label: "Indonesia",       desc: "Indonesian charts" },
  { code: "AR", flag: "🇦🇷", label: "Argentina",       desc: "Argentine music & charts" },
]

function SectionHeader({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3 mb-4">
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <h2 className="font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  )
}

const TARGET_LANGUAGES = [
  "English", "Hindi (Romanized)", "Hindi", "Spanish", "French",
  "German", "Japanese (Romaji)", "Korean (Romanized)", "Arabic (Romanized)",
  "Portuguese", "Italian", "Russian (Romanized)", "Chinese (Pinyin)",
]

export default function SettingsPage() {
  const router = useRouter()
  const { crossfadeSecs, setCrossfadeSecs } = useAudio()
  const [prefs, setPrefs] = useState<UserPreferences>({
    country: "ZZ", language: "en", theme: "system",
    groqApiKey: "", transliterateEnabled: true,
    translationEnabled: true, transliterateLanguage: "English",
  })
  const [saved,           setSaved]           = useState(false)
  const [showCountryList, setShowCountryList] = useState(false)
  const [showApiKey,      setShowApiKey]      = useState(false)
  const [apiKeyInput,     setApiKeyInput]     = useState("")
  const [testingKey,      setTestingKey]      = useState(false)
  const [keyStatus,       setKeyStatus]       = useState<"idle"|"ok"|"fail">("idle")
  // Listening stats
  const [listenStats, setListenStats] = useState({
    today:   0,
    month:   0,
    allTime: 0,
    week:    [] as { date: string; seconds: number }[],
  })
  const [heatmap,        setHeatmap]        = useState<HeatmapDay[]>([])
  const [historyCount,   setHistoryCount]   = useState(0)
  // Party username
  const [partyName,      setPartyName]      = useState("")
  const [partyNameSaved, setPartyNameSaved] = useState(false)

  // Backup / Restore
  const importRef        = useRef<HTMLInputElement>(null)
  const [importStatus,   setImportStatus]   = useState<"idle"|"ok"|"fail">("idle")
  const [importMsg,      setImportMsg]      = useState("")
  const [importMode,     setImportMode]     = useState<"replace"|"merge">("replace")
  const [importing,      setImporting]      = useState(false)

  useEffect(() => {
    const p = getPreferences()
    setPrefs(p)
    setApiKeyInput(p.groqApiKey || "")
    setPartyName(getPartyUsername())
    setListenStats({
      today:   getTodayListenSeconds(),
      month:   getMonthListenSeconds(),
      allTime: getAllTimeListenSeconds(),
      week:    getWeekListenData(),
    })
    setHeatmap(getHeatmapData())
    setHistoryCount(getSongHistory().length)
  }, [])

  const testGroqKey = async (key: string) => {
    if (!key.trim()) return
    setTestingKey(true)
    setKeyStatus("idle")
    try {
      const res = await fetch("/api/groq/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: ["test"], mode: "translate", targetLanguage: "English", apiKey: key }),
      })
      setKeyStatus(res.ok || res.status === 400 ? "ok" : "fail")
    } catch { setKeyStatus("fail") }
    setTestingKey(false)
  }

  const saveApiKey = () => {
    const next = savePreferences({ groqApiKey: apiKeyInput.trim() })
    setPrefs(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
    if (apiKeyInput.trim()) testGroqKey(apiKeyInput.trim())
  }

  const update = (patch: Partial<UserPreferences>) => {
    const next = savePreferences(patch)
    setPrefs(next)
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  const selectedCountry = COUNTRIES.find(c => c.code === prefs.country) || COUNTRIES[0]

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      {/* Sticky header */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/30 px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ChevronLeft className="w-5 h-5" />
        </Button>
        <span className="font-semibold text-lg">Settings</span>
        {saved && (
          <span className="ml-auto flex items-center gap-1.5 text-sm text-emerald-500 font-medium animate-in fade-in slide-in-from-right-2">
            <Check className="w-4 h-4" /> Saved
          </span>
        )}
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-8 pb-36 space-y-8">

        {/* ── Playback Settings ─── */}
        <section>
          <SectionHeader
            icon={<Zap className="w-5 h-5 text-primary" />}
            title="Playback"
            desc="Audio engine settings for crossfade and transitions."
          />
          <div className="rounded-2xl bg-card/40 border border-border/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold">Crossfade</p>
                <p className="text-xs text-muted-foreground">Smooth fade between songs</p>
              </div>
              <span className={`text-sm font-bold tabular-nums px-2.5 py-1 rounded-full ${crossfadeSecs > 0 ? "bg-primary/15 text-primary" : "bg-muted/50 text-muted-foreground"}`}>
                {crossfadeSecs === 0 ? "Off" : `${crossfadeSecs}s`}
              </span>
            </div>
            <Slider
              value={[crossfadeSecs]}
              onValueChange={([v]) => setCrossfadeSecs(v)}
              min={0} max={8} step={2}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground/50 mt-1.5 px-1">
              <span>Off</span><span>2s</span><span>4s</span><span>6s</span><span>8s</span>
            </div>
          </div>

          {/* Emoji Reactions toggle */}
          <div className="rounded-2xl bg-card/40 border border-border/30 px-4 py-3.5 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 text-base">
              🔥
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Song Reactions</p>
              <p className="text-xs text-muted-foreground">Show emoji bar in the player to stamp reactions at timestamps</p>
            </div>
            <button
              onClick={() => {
                const next = savePreferences({ reactionsEnabled: !prefs.reactionsEnabled })
                setPrefs(next); setSaved(true); setTimeout(() => setSaved(false), 1800)
              }}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${prefs.reactionsEnabled ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${prefs.reactionsEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
        </section>

        {/* ── Content Country ─── */}
        <section>
          <SectionHeader
            icon={<Globe className="w-5 h-5 text-primary" />}
            title="Content Country"
            desc="Sets your default region for home feed, charts, and mood playlists."
          />

          {/* Selected country pill */}
          <button
            onClick={() => setShowCountryList(!showCountryList)}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-card/60 border border-border/40 hover:bg-card/80 hover:border-primary/40 transition-all group"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{selectedCountry.flag}</span>
              <div className="text-left">
                <p className="font-semibold">{selectedCountry.label}</p>
                <p className="text-sm text-muted-foreground">{selectedCountry.desc}</p>
              </div>
            </div>
            <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${showCountryList ? "rotate-90" : ""}`} />
          </button>

          {/* Expanded country list */}
          {showCountryList && (
            <div className="mt-2 rounded-2xl border border-border/40 overflow-hidden bg-card/40 backdrop-blur-sm divide-y divide-border/20">
              {COUNTRIES.map(c => (
                <button
                  key={c.code}
                  onClick={() => { update({ country: c.code }); setShowCountryList(false) }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-primary/5 ${prefs.country === c.code ? "bg-primary/10" : ""}`}
                >
                  <span className="text-2xl flex-shrink-0 w-9 text-center">{c.flag}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm ${prefs.country === c.code ? "text-primary" : ""}`}>{c.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{c.desc}</p>
                  </div>
                  {prefs.country === c.code && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-3 px-1">
            Select <strong>Global</strong> to see content from all regions. Changing this affects the home feed, charts, and moods — search is always global.
          </p>
        </section>

        {/* ── AI Features (Groq) ─── */}
        <section>
          <SectionHeader
            icon={<Sparkles className="w-5 h-5 text-primary" />}
            title="AI Features"
            desc="Transliteration & translation powered by Groq (free)"
          />

          {/* API Key input */}
          <div className="rounded-2xl bg-card/40 border border-border/30 overflow-hidden mb-3">
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 border-b border-border/20">
              <Key className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Groq API Key</span>
              {prefs.groqApiKey && (
                <span className="ml-auto flex items-center gap-1 text-xs text-emerald-500 font-medium">
                  <Check className="w-3 h-3" /> Active
                </span>
              )}
            </div>
            <div className="px-4 py-3 space-y-3">
              <div className="relative">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKeyInput}
                  onChange={e => { setApiKeyInput(e.target.value); setKeyStatus("idle") }}
                  placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
                  className="pr-20 font-mono text-sm bg-background/60 border-border/50"
                />
                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
                  {apiKeyInput && (
                    <button
                      onClick={() => { setApiKeyInput(""); setKeyStatus("idle") }}
                      className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <XIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => setShowApiKey(v => !v)}
                    className="p-1 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  onClick={saveApiKey}
                  size="sm"
                  className="rounded-full flex-1 gap-1.5"
                  disabled={testingKey}
                >
                  {testingKey
                    ? <><span className="w-3.5 h-3.5 border border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin inline-block" /> Verifying…</>
                    : <><Key className="w-3.5 h-3.5" /> Save Key</>
                  }
                </Button>
                {keyStatus === "ok"   && <span className="text-xs text-emerald-500 font-medium flex items-center gap-1"><Check className="w-3 h-3" />Valid</span>}
                {keyStatus === "fail" && <span className="text-xs text-red-400 font-medium">Invalid key</span>}
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Get a free key at{" "}
                <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer"
                   className="text-primary underline underline-offset-2">console.groq.com</a>.
                Your key is stored locally and never sent to our servers — it goes directly to Groq.
              </p>
            </div>
          </div>

          {/* AI Feature toggles — only shown when key is set */}
          {prefs.groqApiKey ? (
            <>
              {/* Target language picker */}
              <div className="rounded-2xl bg-card/40 border border-border/30 overflow-hidden mb-3">
                <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 border-b border-border/20">
                  <Languages className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold">Target Language</span>
                  <span className="ml-auto text-xs text-muted-foreground">{prefs.transliterateLanguage || "English"}</span>
                </div>
                <div className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {TARGET_LANGUAGES.map(lang => (
                      <button
                        key={lang}
                        onClick={() => {
                          const next = savePreferences({ transliterateLanguage: lang })
                          setPrefs(next); setSaved(true); setTimeout(() => setSaved(false), 1800)
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                          (prefs.transliterateLanguage || "English") === lang
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-card/60 text-muted-foreground border-border/40 hover:border-primary/40 hover:text-foreground"
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feature toggles */}
              <div className="rounded-2xl bg-card/40 border border-border/30 divide-y divide-border/20 overflow-hidden">
                {[
                  {
                    key: "transliterateEnabled" as const,
                    icon: <Type className="w-4 h-4 text-primary" />,
                    title: "Transliteration",
                    desc: "Show romanized pronunciation in lyrics",
                  },
                  {
                    key: "translationEnabled" as const,
                    icon: <Languages className="w-4 h-4 text-primary" />,
                    title: "Translation",
                    desc: "Show translated lyrics meaning",
                  },
                ].map(({ key, icon, title, desc }) => (
                  <div key={key} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{title}</p>
                      <p className="text-xs text-muted-foreground">{desc}</p>
                    </div>
                    <button
                      onClick={() => {
                        const next = savePreferences({ [key]: !prefs[key] })
                        setPrefs(next); setSaved(true); setTimeout(() => setSaved(false), 1800)
                      }}
                      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${prefs[key] ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${prefs[key] ? "translate-x-5" : "translate-x-0.5"}`} />
                    </button>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground/60 mt-3 px-1">
                AI features appear as buttons in the full-screen lyrics view. Powered by Meta Llama 3.3 70B via Groq.
              </p>
            </>
          ) : (
            <div className="rounded-2xl bg-card/20 border border-dashed border-border/40 px-5 py-6 text-center">
              <Sparkles className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">Add your Groq API key above</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Transliteration & translation will unlock</p>
            </div>
          )}
        </section>

        {/* ── Party Username ─── */}
        <section>
          <SectionHeader
            icon={<User className="w-5 h-5 text-primary" />}
            title="Party Username"
            desc="Your display name when joining or hosting a party session."
          />
          <div className="flex gap-2">
            <Input
              value={partyName}
              onChange={e => setPartyName(e.target.value)}
              placeholder="Guest"
              maxLength={24}
              className="rounded-xl bg-card/40 border-border/40"
            />
            <Button
              onClick={() => {
                savePartyUsername(partyName)
                setPartyNameSaved(true)
                setTimeout(() => setPartyNameSaved(false), 1800)
              }}
              size="sm"
              className="rounded-xl px-5 flex-shrink-0"
            >
              {partyNameSaved ? <><Check className="w-3.5 h-3.5 mr-1.5" />Saved</> : "Save"}
            </Button>
          </div>
        </section>

        {/* ── Listening Stats ─── */}
        <section>
          <SectionHeader
            icon={<Clock className="w-5 h-5 text-primary" />}
            title="Listening Stats"
            desc="Track how much time you spend listening to music."
          />

          {/* Today + This Month cards */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            {[
              { label: "Today",      value: fmtListenTime(listenStats.today),   icon: <Clock    className="w-4 h-4" />, color: "from-blue-500/20 to-cyan-500/10",   border: "border-blue-500/20" },
              { label: "This Month", value: fmtListenTime(listenStats.month),   icon: <Calendar className="w-4 h-4" />, color: "from-purple-500/20 to-pink-500/10", border: "border-purple-500/20" },
            ].map(({ label, value, icon, color, border }) => (
              <div key={label} className={`rounded-2xl bg-gradient-to-br ${color} border ${border} p-4`}>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-2 text-xs">{icon}{label}</div>
                <p className="text-2xl font-bold tabular-nums">{value || "0s"}</p>
              </div>
            ))}
          </div>

          {/* All-time */}
          <div className="rounded-2xl bg-card/40 border border-border/30 px-4 py-3 mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm">
              <BarChart2 className="w-4 h-4 text-primary" />
              <span className="text-muted-foreground">All-time total</span>
            </div>
            <span className="font-bold tabular-nums">{fmtListenTime(listenStats.allTime) || "0s"}</span>
          </div>

          {/* ── Activity Heatmap ── */}
          <div className="rounded-2xl bg-card/40 border border-border/30 p-4 mb-3">
            <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
              <span>Activity — last 26 weeks</span>
            </p>
            {heatmap.length > 0 ? (
              <>
                {/* Grid: 26 cols × 7 rows */}
                <div className="flex gap-[3px] overflow-x-auto pb-1">
                  {Array.from({ length: 26 }).map((_, weekIdx) => {
                    const days = heatmap.slice(weekIdx * 7, weekIdx * 7 + 7)
                    return (
                      <div key={weekIdx} className="flex flex-col gap-[3px]">
                        {days.map((day, dayIdx) => {
                          const colors = [
                            "bg-muted/40",
                            "bg-primary/20",
                            "bg-primary/40",
                            "bg-primary/70",
                            "bg-primary",
                          ]
                          const isToday = day.date === new Date().toISOString().slice(0, 10)
                          return (
                            <div
                              key={dayIdx}
                              title={`${day.date}: ${fmtListenTime(day.seconds)}`}
                              className={[
                                "w-[10px] h-[10px] rounded-[2px] transition-all",
                                colors[day.level],
                                isToday ? "ring-1 ring-primary ring-offset-1 ring-offset-background" : "",
                              ].join(" ")}
                            />
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
                {/* Legend */}
                <div className="flex items-center gap-1.5 mt-2 justify-end">
                  <span className="text-[10px] text-muted-foreground/60">Less</span>
                  {["bg-muted/40", "bg-primary/20", "bg-primary/40", "bg-primary/70", "bg-primary"].map((c, i) => (
                    <div key={i} className={`w-[10px] h-[10px] rounded-[2px] ${c}`} />
                  ))}
                  <span className="text-[10px] text-muted-foreground/60">More</span>
                </div>
              </>
            ) : (
              <p className="text-xs text-muted-foreground/50 text-center py-4">
                Start listening to build your heatmap!
              </p>
            )}
          </div>

          {/* 7-day bar chart */}
          {listenStats.week.some(d => d.seconds > 0) && (
            <div className="rounded-2xl bg-card/40 border border-border/30 p-4 mb-3">
              <p className="text-xs text-muted-foreground mb-3 font-medium">Last 7 Days</p>
              <div className="flex items-end gap-1.5 h-16">
                {listenStats.week.map(({ date, seconds }) => {
                  const maxSecs = Math.max(...listenStats.week.map(d => d.seconds), 1)
                  const pct     = Math.max((seconds / maxSecs) * 100, seconds > 0 ? 8 : 0)
                  const dayName = new Date(date + "T12:00:00").toLocaleDateString("en", { weekday: "short" })
                  const isToday = date === new Date().toISOString().slice(0, 10)
                  return (
                    <div key={date} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className="w-full rounded-t-sm transition-all duration-500"
                        style={{
                          height: `${pct}%`,
                          background: isToday ? "hsl(var(--primary))" : "hsl(var(--primary)/0.35)",
                          minHeight: seconds > 0 ? "4px" : "0",
                        }}
                      />
                      <span className={`text-[9px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                        {dayName}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Song History shortcut */}
          <button
            onClick={() => router.push("/history")}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-card/40 border border-border/30 hover:bg-card/60 hover:border-primary/30 transition-all group mb-3"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold">Song History</p>
                <p className="text-xs text-muted-foreground">{historyCount} song{historyCount !== 1 ? "s" : ""} played</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
          </button>

          {listenStats.allTime === 0 && (
            <p className="text-xs text-muted-foreground/60 text-center py-3">
              Start listening to see your stats appear here.
            </p>
          )}

          {/* Reset button */}
          <button
            onClick={() => {
              if (confirm("Reset all listening stats? This cannot be undone.")) {
                clearListenStats()
                setListenStats({ today: 0, month: 0, allTime: 0, week: getWeekListenData() })
                setHeatmap(getHeatmapData())
              }
            }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Reset listening history
          </button>
        </section>

        {/* ── About ─── */}
        <section>
          <SectionHeader
            icon={<Download className="w-5 h-5 text-primary" />}
            title="Backup & Restore"
            desc="Export all your data as a JSON file, or import a backup to restore liked songs, playlists, history, preferences and more."
          />

          {/* Export */}
          <div className="rounded-2xl bg-card/40 border border-border/30 p-4 mb-3">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <Download className="w-4 h-4 text-green-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Export Data</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Downloads a <code className="bg-muted/60 rounded px-1 text-[11px]">.json</code> backup of all your liked songs, playlists, history, preferences, reactions and collab references.
                </p>
              </div>
            </div>
            <Button
              onClick={() => exportAllData()}
              className="w-full rounded-2xl h-11 gap-2 bg-green-600 hover:bg-green-500 text-white"
            >
              <Download className="w-4 h-4" />
              Download Backup
            </Button>
          </div>

          {/* Import */}
          <div className="rounded-2xl bg-card/40 border border-border/30 p-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                <Upload className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <p className="text-sm font-semibold">Import Data</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Restore from a previously exported backup file.
                </p>
              </div>
            </div>

            {/* Mode selector */}
            <div className="flex gap-2 mb-4">
              {(["replace", "merge"] as const).map(m => (
                <button
                  key={m}
                  onClick={() => setImportMode(m)}
                  className={[
                    "flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all",
                    importMode === m
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border/40 bg-card/30 text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                >
                  {m === "replace" ? "🔄 Replace All" : "➕ Merge"}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground/70 mb-4 px-1">
              {importMode === "replace"
                ? "⚠️ Replace mode wipes all current data before restoring. Use when moving to a new device."
                : "Merge mode adds backup data on top of existing data — existing liked songs & playlists are kept."}
            </p>

            {/* Status message */}
            {importStatus !== "idle" && (
              <div className={[
                "flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-3 text-sm",
                importStatus === "ok"
                  ? "bg-green-500/10 text-green-400 border border-green-500/20"
                  : "bg-destructive/10 text-destructive border border-destructive/20",
              ].join(" ")}>
                {importStatus === "ok"
                  ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  : <AlertCircle  className="w-4 h-4 flex-shrink-0" />}
                <span>{importMsg}</span>
              </div>
            )}

            {/* Hidden file input */}
            <input
              ref={importRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setImporting(true)
                setImportStatus("idle")
                try {
                  const text   = await file.text()
                  const result = importAllData(text, importMode)
                  if (result.ok) {
                    setImportStatus("ok")
                    setImportMsg(`Restored ${result.keysRestored} data group${result.keysRestored !== 1 ? "s" : ""}. Refresh the app to see changes.`)
                  } else {
                    setImportStatus("fail")
                    setImportMsg(result.error || "Import failed")
                  }
                } catch (err: any) {
                  setImportStatus("fail")
                  setImportMsg(err?.message || "Could not read file")
                } finally {
                  setImporting(false)
                  // Reset so same file can be picked again
                  if (importRef.current) importRef.current.value = ""
                }
              }}
            />

            <Button
              onClick={() => importRef.current?.click()}
              disabled={importing}
              variant="outline"
              className="w-full rounded-2xl h-11 gap-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
            >
              {importing
                ? <><span className="animate-spin">⏳</span> Importing…</>
                : <><Upload className="w-4 h-4" />Choose Backup File</>
              }
            </Button>
          </div>
        </section>

                <section>
          <SectionHeader
            icon={<Info className="w-5 h-5 text-primary" />}
            title="About"
            desc="App information & credits"
          />

          {/* Hero card */}
          <div className="rounded-2xl bg-gradient-to-br from-primary/20 via-primary/8 to-accent/10 border border-primary/20 p-5 mb-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <ImageWithFallback
                src="https://raw.githubusercontent.com/wilooper/Asset/main/logo.png"
                alt="Musicanaz"
                className="w-10 h-10 rounded-xl object-contain"
              />
              <h3 className="text-xl font-bold tracking-tight">Musicanaz</h3>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
              A beautifully crafted music streaming experience — search, stream, and discover music without limits.
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-3 text-sm font-medium">
              <span>Made with</span>
              <span className="text-red-500 text-base">❤️</span>
              <span>by</span>
              <span className="text-primary font-semibold">Shaurya Singh</span>
              <span>&</span>
              <ImageWithFallback
                src="https://www.anthropic.com/favicon.ico"
                alt="Claude"
                className="w-4 h-4 rounded inline-block"
              />
              <span className="text-primary font-semibold">Claude AI</span>
            </div>
          </div>

          {/* Tech stack — Backend */}
          <div className="rounded-2xl bg-card/40 border border-border/30 overflow-hidden mb-3">
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/20">
              <div className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-orange-500">BE</span>
              </div>
              <span className="text-sm font-semibold">Backend</span>
              <span className="text-xs text-muted-foreground ml-auto">by Shaurya Singh & Claude</span>
            </div>
            <div className="divide-y divide-border/20">
              {[
                ["Framework",  "FastAPI (Python)"],
                ["Music API",  "ytmusicapi (YouTube Music)"],
                ["Hosting",    "Render — Free 512 MB tier"],
                ["Caching",    "In-memory TTL LRU cache"],
                ["Endpoints",  "24 routes — search, stream, lyrics…"],
                ["Version",    "v4.0.0"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Tech stack — Frontend */}
          <div className="rounded-2xl bg-card/40 border border-border/30 overflow-hidden mb-3">
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/20">
              <div className="w-5 h-5 rounded bg-blue-500/20 flex items-center justify-center">
                <span className="text-[10px] font-bold text-blue-500">FE</span>
              </div>
              <span className="text-sm font-semibold">Frontend</span>
              <span className="text-xs text-muted-foreground ml-auto">by v0 · Vercel & Claude</span>
            </div>
            <div className="divide-y divide-border/20">
              {[
                ["Framework",   "Next.js 15 (App Router)"],
                ["UI Library",  "shadcn/ui + Tailwind CSS"],
                ["Scaffolding", "v0 by Vercel"],
                ["Hosting",     "Vercel"],
                ["Player",      "YouTube IFrame API"],
                ["Features",    "Lyrics, SponsorBlock, Cache, DL"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="text-sm font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Misc */}
          <div className="rounded-2xl bg-card/40 border border-border/30 divide-y divide-border/20 overflow-hidden">
            {[
              ["App",          "Musicanaz"],
              ["Version",      "1.0.0"],
              ["Open Source",  "No authentication required"],
              ["Data source",  "YouTube Music (unofficial)"],
              ["SponsorBlock", "Community-powered segment skip"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="text-sm font-medium text-right">{value}</span>
              </div>
            ))}
          </div>

          <p className="text-xs text-center text-muted-foreground/50 mt-4 px-2">
            Musicanaz is not affiliated with YouTube or Google. All music data is sourced from YouTube Music via an unofficial API for personal use.
          </p>
        </section>

      </div>
    </div>
  )
}
