/**
 * Musicanaz Badge & XP System  (lib/storage-badges.ts)
 * Extracted from storage.ts to keep it focused.
 * Uses SharedStore for all badge data.
 */
import { SharedStore } from "./store"
import { getAllTimeListenSeconds, getPlaylists, getSongHistory, getListenStats } from "./storage"

const BADGE_EVENTS_KEY = "badge_events_full"
const BADGE_EARNED_KEY = "badge_earned_set"
const BADGE_TIMES_KEY  = "badge_earned_times"

export type BadgeTier = "normal" | "uncommon" | "epic" | "rare"
export interface Badge {
  id: string; name: string; description: string; emoji: string
  tier: BadgeTier; xp: number; category: "streak_app"|"streak_song"|"listening_time"|"time_based"|"behavior"
}
export interface BadgeStatus extends Badge {
  earned: boolean; earnedAt?: number; progress: number; current: number; target: number
}
export interface BadgeEvent { type: string; at: number; meta?: string }

// ── Event log ────────────────────────────────────────────────────────────────

export function getBadgeEvents(): BadgeEvent[] {
  return SharedStore.get<BadgeEvent[]>(BADGE_EVENTS_KEY, [])
}
function saveBadgeEvents(evs: BadgeEvent[]): void {
  SharedStore.set(BADGE_EVENTS_KEY, evs.slice(0, 5000))
}
export function recordBadgeEvent(type: string, meta?: string): void {
  const evs = getBadgeEvents()
  evs.unshift({ type, at: Date.now(), meta })
  saveBadgeEvents(evs)
}

// ── Earned tracking ──────────────────────────────────────────────────────────

function getEarnedBadgeIdSet(): Set<string> {
  return new Set(SharedStore.get<string[]>(BADGE_EARNED_KEY, []))
}
function getEarnedBadgeTimes(): Record<string, number> {
  return SharedStore.get<Record<string, number>>(BADGE_TIMES_KEY, {})
}
export function markBadgeEarned(id: string): void {
  const ids = getEarnedBadgeIdSet(); ids.add(id)
  SharedStore.set(BADGE_EARNED_KEY, [...ids])
  const times = getEarnedBadgeTimes()
  if (!times[id]) { times[id] = Date.now(); SharedStore.set(BADGE_TIMES_KEY, times) }
}

// ── Definitions ──────────────────────────────────────────────────────────────

const XP: Record<BadgeTier, number> = { normal: 50, uncommon: 100, epic: 250, rare: 500 }
const b = (id: string, name: string, desc: string, emoji: string, tier: BadgeTier, cat: Badge["category"]): Badge =>
  ({ id, name, description: desc, emoji, tier, xp: XP[tier], category: cat })

export const ALL_BADGES: Badge[] = [
  b("streak_app_1","First Spark","1 day app streak","✨","normal","streak_app"),
  b("streak_app_3","3 Day Flow","3 day app streak","🌊","normal","streak_app"),
  b("streak_app_7","Weekly Listener","7 day app streak","🎧","uncommon","streak_app"),
  b("streak_app_10","10 Day Rhythm","10 day app streak","🥁","uncommon","streak_app"),
  b("streak_app_14","Fortnight Flame","14 day app streak","🔥","uncommon","streak_app"),
  b("streak_app_30","Monthly Vibes","30 day app streak","🌙","epic","streak_app"),
  b("streak_app_60","60 Day Momentum","60 day app streak","⚡","epic","streak_app"),
  b("streak_app_90","90 Day Harmony","90 day app streak","🎼","epic","streak_app"),
  b("streak_app_180","Half-Year Devotion","180 day app streak","💎","rare","streak_app"),
  b("streak_app_365","365 Day Legend","365 day app streak","👑","rare","streak_app"),
  b("streak_song_3","Repeat Rookie","3 day same-song streak","🔁","normal","streak_song"),
  b("streak_song_5","Loop Lover","5 day same-song streak","💫","normal","streak_song"),
  b("streak_song_7","Hooked Hook","7 day same-song streak","🎣","uncommon","streak_song"),
  b("streak_song_10","Chorus Keeper","10 day same-song streak","🎤","uncommon","streak_song"),
  b("streak_song_15","Unskippable","15 day same-song streak","📌","uncommon","streak_song"),
  b("streak_song_30","Melody Loyalist","30 day same-song streak","🎵","epic","streak_song"),
  b("streak_song_60","Track Devotion","60 day same-song streak","💝","epic","streak_song"),
  b("streak_song_90","Obsession Mode","90 day same-song streak","🌀","epic","streak_song"),
  b("streak_song_180","Timeless Bond","180 day same-song streak","∞","rare","streak_song"),
  b("streak_song_365","One Song Eternity","365 day same-song streak","🏛️","rare","streak_song"),
  b("time_30m","30 Minute Mood","30 total listening minutes","😌","normal","listening_time"),
  b("time_2h","2 Hour Explorer","2 total listening hours","🗺️","normal","listening_time"),
  b("time_10h","10 Hour Listener","10 total hours","🎯","uncommon","listening_time"),
  b("time_25h","25 Hour Groove","25 total hours","🕺","uncommon","listening_time"),
  b("time_50h","50 Hour Pulse","50 total hours","💓","uncommon","listening_time"),
  b("time_100h","100 Hour Immersion","100 total hours","🔮","epic","listening_time"),
  b("time_250h","250 Hour Devotee","250 total hours","🌟","epic","listening_time"),
  b("time_500h","500 Hour Addict","500 total hours","🚀","epic","listening_time"),
  b("time_1000h","1000 Hour Master","1000 total hours","🏆","rare","listening_time"),
  b("time_2000h","Sound Immortal","2000 total hours","🪐","rare","listening_time"),
  b("night_3","Night Owl","3 late-night sessions","🦉","normal","time_based"),
  b("night_7","Midnight Rider","7 late-night sessions","🌃","uncommon","time_based"),
  b("night_15","3AM Soul","15 sessions at 3 AM","🌑","epic","time_based"),
  b("night_100","After Dark Legend","100 midnight sessions","🌌","rare","time_based"),
  b("morning_5","Sunrise Seeker","5 early-morning sessions","🌅","normal","time_based"),
  b("morning_30","Dawn Devotion","30 early-morning sessions","☀️","epic","time_based"),
  b("noskip_10","No Skip Session","10 songs without skipping","🎵","normal","behavior"),
  b("noskip_50","Skip Resistant","50 songs without skipping","🛡️","uncommon","behavior"),
  b("noskip_100","Zen Listener","100 songs without skipping","🧘","epic","behavior"),
  b("genre_5","Genre Explorer","5 different genres explored","🌍","normal","behavior"),
  b("genre_15","Sound Adventurer","15 genres explored","🧭","uncommon","behavior"),
  b("genre_30","Sonic Traveller","30 genres explored","✈️","epic","behavior"),
  b("volume_20","Volume Warrior","20 max-volume sessions","🔊","normal","behavior"),
  b("playlist_10","Playlist Architect","Create 10 playlists","📋","uncommon","behavior"),
  b("heatmap_25","Heatmap Hero","Active 25 days in one month","🗓️","uncommon","behavior"),
  b("silent_week","Silent Week","Return after 7 days inactive","🔔","epic","behavior"),
  b("royalty","Musicanaz Royalty","Unlock 25 total badges","👑","rare","behavior"),
]

// ── Streak helpers ────────────────────────────────────────────────────────────

function getAppStreakDays(): number {
  const stats = getListenStats() as Record<string, number>
  let streak = 0
  const today = new Date()
  for (let i = 0; i < 400; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    if ((stats[d.toISOString().slice(0, 10)] ?? 0) > 0) streak++
    else if (i > 0) break
  }
  return streak
}

function getSongStreakDays(): { songId: string; days: number } {
  const history = getSongHistory()
  if (!history.length) return { songId: "", days: 0 }
  const songDays = new Map<string, Set<string>>()
  for (const e of history) {
    const key = new Date(e.playedAt).toISOString().slice(0, 10)
    if (!songDays.has(e.song.id)) songDays.set(e.song.id, new Set())
    songDays.get(e.song.id)!.add(key)
  }
  let best = { songId: "", days: 0 }
  for (const [songId, dateSet] of songDays) {
    let streak = 0
    const today = new Date()
    for (let i = 0; i < 400; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i)
      if (dateSet.has(d.toISOString().slice(0, 10))) streak++
      else if (i > 0) break
    }
    if (streak > best.days) best = { songId, days: streak }
  }
  return best
}

// ── Evaluation ───────────────────────────────────────────────────────────────

export function evaluateBadges(): BadgeStatus[] {
  const earnedIds   = getEarnedBadgeIdSet()
  const earnedTimes = getEarnedBadgeTimes()
  const events      = getBadgeEvents()
  const totalHours  = getAllTimeListenSeconds() / 3600
  const appStreak   = getAppStreakDays()
  const songStreak  = getSongStreakDays()
  const heatmap     = getListenStats() as Record<string, number>
  const playlists   = getPlaylists()

  const noSkipCount = (() => {
    let count = 0, max = 0
    for (const ev of [...events].reverse()) {
      if (ev.type === "song_complete") { count++; max = Math.max(max, count) }
      else if (ev.type === "skip") count = 0
    }
    return max
  })()

  const genres = new Set(events.filter(e => e.type === "genre_play" && e.meta).map(e => e.meta!))
  const volumeMaxCount = events.filter(e => e.type === "volume_max").length
  const nightSessions  = events.filter(e => e.type === "session_start" && new Date(e.at).getHours() < 4).length
  const at3am          = events.filter(e => e.type === "session_start" && new Date(e.at).getHours() === 3).length
  const morningSessions = events.filter(e => { const h = new Date(e.at).getHours(); return e.type === "session_start" && h >= 5 && h <= 8 }).length
  const thisMonth = new Date().toISOString().slice(0, 7)
  const activeDaysThisMonth = Object.entries(heatmap).filter(([k, v]) => k.startsWith(thisMonth) && v > 0).length
  const hasSilentWeek = (() => {
    const keys = Object.keys(heatmap).sort()
    for (let i = 1; i < keys.length; i++) {
      if (new Date(keys[i]).getTime() - new Date(keys[i-1]).getTime() >= 7 * 86_400_000) return true
    }
    return false
  })()

  const valueMap: Record<string, { current: number; target: number }> = {
    streak_app_1:{current:appStreak,target:1}, streak_app_3:{current:appStreak,target:3},
    streak_app_7:{current:appStreak,target:7}, streak_app_10:{current:appStreak,target:10},
    streak_app_14:{current:appStreak,target:14}, streak_app_30:{current:appStreak,target:30},
    streak_app_60:{current:appStreak,target:60}, streak_app_90:{current:appStreak,target:90},
    streak_app_180:{current:appStreak,target:180}, streak_app_365:{current:appStreak,target:365},
    streak_song_3:{current:songStreak.days,target:3}, streak_song_5:{current:songStreak.days,target:5},
    streak_song_7:{current:songStreak.days,target:7}, streak_song_10:{current:songStreak.days,target:10},
    streak_song_15:{current:songStreak.days,target:15}, streak_song_30:{current:songStreak.days,target:30},
    streak_song_60:{current:songStreak.days,target:60}, streak_song_90:{current:songStreak.days,target:90},
    streak_song_180:{current:songStreak.days,target:180}, streak_song_365:{current:songStreak.days,target:365},
    time_30m:{current:totalHours*60,target:30}, time_2h:{current:totalHours,target:2},
    time_10h:{current:totalHours,target:10}, time_25h:{current:totalHours,target:25},
    time_50h:{current:totalHours,target:50}, time_100h:{current:totalHours,target:100},
    time_250h:{current:totalHours,target:250}, time_500h:{current:totalHours,target:500},
    time_1000h:{current:totalHours,target:1000}, time_2000h:{current:totalHours,target:2000},
    night_3:{current:nightSessions,target:3}, night_7:{current:nightSessions,target:7},
    night_15:{current:at3am,target:15}, night_100:{current:nightSessions,target:100},
    morning_5:{current:morningSessions,target:5}, morning_30:{current:morningSessions,target:30},
    noskip_10:{current:noSkipCount,target:10}, noskip_50:{current:noSkipCount,target:50},
    noskip_100:{current:noSkipCount,target:100}, genre_5:{current:genres.size,target:5},
    genre_15:{current:genres.size,target:15}, genre_30:{current:genres.size,target:30},
    volume_20:{current:volumeMaxCount,target:20}, playlist_10:{current:playlists.length,target:10},
    heatmap_25:{current:activeDaysThisMonth,target:25}, silent_week:{current:hasSilentWeek?1:0,target:1},
    royalty:{current:0,target:25},
  }

  const results: BadgeStatus[] = ALL_BADGES.map(badge => {
    const v = valueMap[badge.id] ?? { current: 0, target: 1 }
    const metEarly = earnedIds.has(badge.id)
    const metNow   = v.current >= v.target
    const earned   = metEarly || metNow
    if (earned && !metEarly) markBadgeEarned(badge.id)
    return { ...badge, earned, earnedAt: earnedTimes[badge.id], progress: Math.min(1, v.current / v.target), current: v.current, target: v.target }
  })

  const earnedCount = results.filter(r => r.earned && r.id !== "royalty").length
  const royalty = results.find(r => r.id === "royalty")!
  royalty.current = earnedCount; royalty.progress = Math.min(1, earnedCount / 25)
  if (!royalty.earned && earnedCount >= 25) { royalty.earned = true; markBadgeEarned("royalty") }

  return results
}

export function getEarnedBadges(): BadgeStatus[] { return evaluateBadges().filter(b => b.earned) }
export function getTotalXP(): number { return getEarnedBadges().reduce((acc, b) => acc + b.xp, 0) }
export function getXPLevel(xp: number): { level: number; title: string; nextAt: number } {
  const t = [
    {level:1,title:"Newcomer",nextAt:100},{level:2,title:"Listener",nextAt:300},
    {level:3,title:"Music Fan",nextAt:600},{level:4,title:"Enthusiast",nextAt:1000},
    {level:5,title:"Devotee",nextAt:1500},{level:6,title:"Connoisseur",nextAt:2500},
    {level:7,title:"Legend",nextAt:4000},{level:8,title:"Immortal",nextAt:Infinity},
  ]
  return t.find(x => xp < x.nextAt) ?? t[t.length-1]
}

