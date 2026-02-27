"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  ChevronLeft, Clock, Music, Trash2, Play,
  Search, BarChart2, Calendar, Flame, Trophy,
  TrendingUp, Star, Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import ImageWithFallback from "@/components/image-with-fallback"
import {
  getSongHistory, getDeduplicatedHistory, clearSongHistory,
  getTopPlayedSongs, getAllTimeTopSongs, type HistoryEntry, type TopSong,
  getTodayListenSeconds, getMonthListenSeconds, getAllTimeListenSeconds,
  getWeekListenData, fmtListenTime, getHeatmapData, type HeatmapDay,
} from "@/lib/storage"
import { useAudio } from "@/lib/audio-context"
import dynamic from "next/dynamic"

const WrappedCard = dynamic(() => import("@/components/wrapped-card"), { ssr: false })

/* ─── helpers ────────────────────────────────────────────── */
function timeAgo(ms: number): string {
  const diff  = Date.now() - ms
  const mins  = Math.floor(diff / 60_000)
  const hours = Math.floor(diff / 3_600_000)
  const days  = Math.floor(diff / 86_400_000)
  if (mins  < 1)  return "just now"
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days  < 7)  return `${days}d ago`
  return new Date(ms).toLocaleDateString("en", { month: "short", day: "numeric" })
}

function groupByDate(entries: HistoryEntry[]): { label: string; items: HistoryEntry[] }[] {
  const groups: Map<string, HistoryEntry[]> = new Map()
  const today     = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10)
  for (const e of entries) {
    const d = new Date(e.playedAt).toISOString().slice(0, 10)
    const label =
      d === today     ? "Today" :
      d === yesterday ? "Yesterday" :
      new Date(e.playedAt).toLocaleDateString("en", { weekday: "long", month: "short", day: "numeric" })
    if (!groups.has(label)) groups.set(label, [])
    groups.get(label)!.push(e)
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }))
}

/* ─── Sub-components ─────────────────────────────────────── */
function StatCard({
  icon, label, value, gradient, border,
}: {
  icon: React.ReactNode; label: string; value: string
  gradient: string; border: string
}) {
  return (
    <div className={`rounded-2xl bg-gradient-to-br ${gradient} border ${border} p-4`}>
      <div className="flex items-center gap-1.5 text-muted-foreground mb-2 text-xs">{icon}{label}</div>
      <p className="text-2xl font-bold tabular-nums leading-tight">{value || "0s"}</p>
    </div>
  )
}

function Heatmap({ data }: { data: HeatmapDay[] }) {
  if (!data.length) return null
  const todayKey = new Date().toISOString().slice(0, 10)
  const COLORS   = ["bg-muted/30", "bg-primary/20", "bg-primary/40", "bg-primary/65", "bg-primary"]

  return (
    <div className="rounded-2xl bg-card/40 border border-border/30 p-4">
      <p className="text-xs font-semibold text-muted-foreground mb-3">Activity — last 26 weeks</p>
      <div className="flex gap-[3px] overflow-x-auto pb-1 scrollbar-hide">
        {Array.from({ length: 26 }).map((_, wi) => (
          <div key={wi} className="flex flex-col gap-[3px] flex-shrink-0">
            {data.slice(wi * 7, wi * 7 + 7).map((day, di) => (
              <div
                key={di}
                title={`${day.date}: ${fmtListenTime(day.seconds)}`}
                className={[
                  "w-[10px] h-[10px] rounded-[2px] transition-colors",
                  COLORS[day.level],
                  day.date === todayKey ? "ring-1 ring-primary ring-offset-1 ring-offset-background" : "",
                ].join(" ")}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5 mt-2 justify-end">
        <span className="text-[10px] text-muted-foreground/50">Less</span>
        {COLORS.map((c, i) => <div key={i} className={`w-[10px] h-[10px] rounded-[2px] ${c}`} />)}
        <span className="text-[10px] text-muted-foreground/50">More</span>
      </div>
    </div>
  )
}

function WeekChart({ data }: { data: { date: string; seconds: number }[] }) {
  if (!data.some(d => d.seconds > 0)) return null
  const maxSecs  = Math.max(...data.map(d => d.seconds), 1)
  const todayKey = new Date().toISOString().slice(0, 10)
  return (
    <div className="rounded-2xl bg-card/40 border border-border/30 p-4">
      <p className="text-xs font-semibold text-muted-foreground mb-3">Last 7 days</p>
      <div className="flex items-end gap-1.5 h-16">
        {data.map(({ date, seconds }) => {
          const pct     = Math.max((seconds / maxSecs) * 100, seconds > 0 ? 6 : 0)
          const dayName = new Date(date + "T12:00:00").toLocaleDateString("en", { weekday: "short" })
          const isToday = date === todayKey
          return (
            <div key={date} className="flex-1 flex flex-col items-center gap-1">
              <div
                title={fmtListenTime(seconds)}
                className="w-full rounded-t-sm transition-all"
                style={{
                  height:     `${pct}%`,
                  background: isToday ? "hsl(var(--primary))" : "hsl(var(--primary)/0.35)",
                  minHeight:  seconds > 0 ? "4px" : "0",
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
  )
}

function TopSongsSection({
  title, icon, songs, onPlay, iconBg,
}: {
  title: string
  icon:  React.ReactNode
  songs: TopSong[]
  onPlay: (s: TopSong["song"]) => void
  iconBg: string
}) {
  if (!songs.length) return null
  const medals = ["🥇", "🥈", "🥉"]

  return (
    <div className="rounded-2xl bg-card/40 border border-border/30 overflow-hidden">
      {/* Header */}
      <div className={`flex items-center gap-2.5 px-4 py-3 border-b border-border/20 ${iconBg}`}>
        <div className="w-7 h-7 rounded-lg bg-background/30 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-auto text-xs text-muted-foreground">{songs.length} song{songs.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Songs */}
      <div className="divide-y divide-border/10">
        {songs.map((entry, i) => (
          <div
            key={entry.song.id}
            onClick={() => onPlay(entry.song)}
            className="group flex items-center gap-3 px-4 py-3 hover:bg-primary/5 transition-colors cursor-pointer"
          >
            {/* Rank */}
            <span className="text-base w-6 text-center flex-shrink-0 leading-none">
              {medals[i] ?? <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>}
            </span>

            {/* Thumbnail */}
            <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0">
              <ImageWithFallback
                src={entry.song.thumbnail}
                alt={entry.song.title}
                className="w-full h-full object-cover"
                fallback={
                  <div className="w-full h-full flex items-center justify-center bg-muted">
                    <Music className="w-4 h-4 text-muted-foreground" />
                  </div>
                }
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
                <Play className="w-3.5 h-3.5 text-white opacity-0 group-hover:opacity-100 fill-white" />
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate leading-tight">{entry.song.title}</p>
              <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.song.artist}</p>
            </div>

            {/* Play count badge */}
            <div className="flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-1 flex-shrink-0">
              <Play className="w-2.5 h-2.5 fill-primary" />
              <span className="text-xs font-bold tabular-nums">{entry.plays}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function HistoryRow({ entry, onPlay }: { entry: HistoryEntry; onPlay: () => void }) {
  return (
    <div
      onClick={onPlay}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-card/60 transition-colors cursor-pointer"
    >
      <div className="relative w-11 h-11 rounded-xl overflow-hidden bg-muted flex-shrink-0">
        <ImageWithFallback
          src={entry.song.thumbnail}
          alt={entry.song.title}
          className="w-full h-full object-cover"
          fallback={
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <Music className="w-4 h-4 text-muted-foreground" />
            </div>
          }
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 flex items-center justify-center transition-all">
          <Play className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 fill-white" />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate leading-tight">{entry.song.title}</p>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{entry.song.artist}</p>
      </div>
      <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 tabular-nums">
        {timeAgo(entry.playedAt)}
      </span>
    </div>
  )
}

/* ─── Page ───────────────────────────────────────────────── */
export default function HistoryPage() {
  const router       = useRouter()
  const { playSong } = useAudio()

  const [query,      setQuery]      = useState("")
  const [activeTab,  setActiveTab]  = useState<"stats" | "top" | "history">("stats")
  const [showWrapped,setShowWrapped]= useState(false)
  const [topAllTime, setTopAllTime] = useState<TopSong[]>([])

  // Stats
  const [stats, setStats] = useState({ today: 0, month: 0, allTime: 0 })
  const [week,  setWeek]  = useState<{ date: string; seconds: number }[]>([])
  const [heat,  setHeat]  = useState<HeatmapDay[]>([])

  // Top played
  const [topDay,   setTopDay]   = useState<TopSong[]>([])
  const [topWeek,  setTopWeek]  = useState<TopSong[]>([])
  const [topMonth, setTopMonth] = useState<TopSong[]>([])

  // History list
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    setStats({
      today:   getTodayListenSeconds(),
      month:   getMonthListenSeconds(),
      allTime: getAllTimeListenSeconds(),
    })
    setWeek(getWeekListenData())
    setHeat(getHeatmapData())
    setTopDay(getTopPlayedSongs("day",   5))
    setTopWeek(getTopPlayedSongs("week",  5))
    setTopMonth(getTopPlayedSongs("month", 5))
    setTopAllTime(getAllTimeTopSongs(5))
    setHistory(getDeduplicatedHistory())
  }, [])

  const handleClear = () => {
    if (!confirm("Clear all song history? This cannot be undone.")) return
    clearSongHistory()
    setHistory([])
    setTopDay([])
    setTopWeek([])
    setTopMonth([])
  }

  const filtered = query.trim()
    ? history.filter(e =>
        e.song.title.toLowerCase().includes(query.toLowerCase()) ||
        e.song.artist.toLowerCase().includes(query.toLowerCase())
      )
    : history
  const groups = groupByDate(filtered)

  const hasAnyTop = topDay.length || topWeek.length || topMonth.length

  return (
    <>
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">

      {/* ── Sticky Header ── */}
      <div className="sticky top-0 z-20 bg-background/90 backdrop-blur-md border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full flex-shrink-0">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <Clock className="w-5 h-5 text-primary" />
            <span className="font-bold text-lg">History</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowWrapped(true)}
              className="flex items-center gap-1.5 text-xs font-semibold bg-primary/15 hover:bg-primary/25 text-primary transition-colors px-3 py-1.5 rounded-full"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Wrapped
            </button>
            {history.length > 0 && (
              <button
                onClick={handleClear}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex px-4 pb-0 gap-0 border-t border-border/20">
          {([
            { id: "stats",   label: "Stats",   icon: <BarChart2  className="w-3.5 h-3.5" /> },
            { id: "top",     label: "Top Played", icon: <Trophy className="w-3.5 h-3.5" /> },
            { id: "history", label: "History",  icon: <Clock     className="w-3.5 h-3.5" /> },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-1.5 px-4 py-3 text-xs font-semibold border-b-2 transition-all",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="container max-w-2xl mx-auto px-4 py-5 pb-36 space-y-4">

        {/* ══════════════ STATS TAB ══════════════ */}
        {activeTab === "stats" && (
          <>
            {/* Stat cards */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={<Clock    className="w-3.5 h-3.5" />}
                label="Today"
                value={fmtListenTime(stats.today)}
                gradient="from-blue-500/20 to-cyan-500/10"
                border="border-blue-500/20"
              />
              <StatCard
                icon={<Calendar className="w-3.5 h-3.5" />}
                label="This Month"
                value={fmtListenTime(stats.month)}
                gradient="from-violet-500/20 to-pink-500/10"
                border="border-violet-500/20"
              />
            </div>

            {/* All-time row */}
            <div className="rounded-2xl bg-card/40 border border-border/30 px-4 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Star className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">All-time listening</p>
                  <p className="text-xs text-muted-foreground">{history.length} unique songs played</p>
                </div>
              </div>
              <span className="text-lg font-bold tabular-nums text-primary">
                {fmtListenTime(stats.allTime) || "0s"}
              </span>
            </div>

            {/* 7-day bar chart */}
            <WeekChart data={week} />

            {/* 26-week heatmap */}
            <Heatmap data={heat} />

            {stats.allTime === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <BarChart2 className="w-7 h-7 text-primary/40" />
                </div>
                <p className="text-sm font-semibold mb-1">No stats yet</p>
                <p className="text-xs text-muted-foreground">Start listening to see your stats here</p>
                <Button onClick={() => router.push("/")} className="mt-4 rounded-full px-7 h-9 text-sm">
                  Discover Music
                </Button>
              </div>
            )}
          </>
        )}

        {/* ══════════════ TOP PLAYED TAB ══════════════ */}
        {activeTab === "top" && (
          <>
            {hasAnyTop ? (
              <>
                <TopSongsSection
                  title="⭐ All-Time Favourites"
                  icon={<Star className="w-4 h-4 text-primary" />}
                  songs={topAllTime}
                  onPlay={s => playSong(s)}
                  iconBg="bg-primary/8"
                />
                <TopSongsSection
                  title="🔥 Top of the Day"
                  icon={<Flame className="w-4 h-4 text-orange-400" />}
                  songs={topDay}
                  onPlay={s => playSong(s)}
                  iconBg="bg-orange-500/8"
                />
                <TopSongsSection
                  title="📅 Top of the Week"
                  icon={<TrendingUp className="w-4 h-4 text-blue-400" />}
                  songs={topWeek}
                  onPlay={s => playSong(s)}
                  iconBg="bg-blue-500/8"
                />
                <TopSongsSection
                  title="🏆 Top of the Month"
                  icon={<Trophy className="w-4 h-4 text-yellow-400" />}
                  songs={topMonth}
                  onPlay={s => playSong(s)}
                  iconBg="bg-yellow-500/8"
                />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Trophy className="w-7 h-7 text-primary/40" />
                </div>
                <p className="text-sm font-semibold mb-1">No top songs yet</p>
                <p className="text-xs text-muted-foreground">Play some songs and your favorites will show up here</p>
                <Button onClick={() => router.push("/")} className="mt-4 rounded-full px-7 h-9 text-sm">
                  Start Listening
                </Button>
              </div>
            )}
          </>
        )}

        {/* ══════════════ HISTORY TAB ══════════════ */}
        {activeTab === "history" && (
          <>
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                  <Clock className="w-7 h-7 text-primary/40" />
                </div>
                <p className="text-sm font-semibold mb-1">No history yet</p>
                <p className="text-xs text-muted-foreground max-w-xs">Songs you play will appear here</p>
                <Button onClick={() => router.push("/")} className="mt-4 rounded-full px-7 h-9 text-sm">
                  Discover Music
                </Button>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Search history…"
                    className="w-full h-10 pl-10 pr-4 rounded-2xl bg-card/50 border border-border/40 text-sm focus:outline-none focus:border-primary/50 transition-all"
                  />
                </div>

                <p className="text-xs text-muted-foreground px-1">
                  {filtered.length} song{filtered.length !== 1 ? "s" : ""}
                </p>

                {groups.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10 opacity-60">
                    No results for "{query}"
                  </p>
                ) : (
                  groups.map(({ label, items }) => (
                    <div key={label} className="space-y-1">
                      <div className="flex items-center gap-3 py-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          {label}
                        </span>
                        <div className="flex-1 h-px bg-border/30" />
                        <span className="text-[10px] text-muted-foreground/50">{items.length}</span>
                      </div>
                      {items.map((entry, i) => (
                        <HistoryRow
                          key={`${entry.song.id}-${entry.playedAt}-${i}`}
                          entry={entry}
                          onPlay={() => playSong(entry.song)}
                        />
                      ))}
                    </div>
                  ))
                )}
              </>
            )}
          </>
        )}

      </div>
    </div>

    {/* ── Wrapped fullscreen overlay ── */}
    {showWrapped && <WrappedCard onClose={() => setShowWrapped(false)} />}
    </>
  )
}
