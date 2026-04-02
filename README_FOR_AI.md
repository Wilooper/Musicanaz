# Musicanaz — Technical Reference for AI Assistants

> This document is written for AI coding assistants (Copilot, Cursor, Claude, etc.).  
> It explains the architecture, data flow, conventions, and key invariants of the codebase so that
> generated code stays consistent with existing patterns.

---

## 1. Stack at a Glance

| Layer | Technology | Notes |
|---|---|---|
| Framework | **Next.js 16** (App Router) | `app/` directory, Server + Client Components |
| UI library | **React 19** | Hooks, Context API |
| Language | **TypeScript 5** (strict) | Path alias `@/*` → repo root |
| Styling | **Tailwind CSS v4** | `cn()` helper from `lib/utils.ts` |
| Components | **Radix UI + shadcn/ui** | Primitives in `components/ui/` |
| State | **React Context + localStorage** | No Redux / Zustand |
| Package manager | **pnpm** | Use `pnpm` for all installs |

---

## 2. Directory Conventions

```
app/               Next.js pages + API route handlers
  api/             Server-only route handlers (never import in Client Components)
components/        Shared React components
  ui/              Radix UI wrappers — do not edit generated files manually
lib/               Utilities, context providers, and typed helpers
public/            Static assets
```

- **All pages are Client Components** (`"use client"`) unless they are purely data-fetching.
- **API routes** (`app/api/**/route.ts`) are server-only. They proxy external services and never expose secrets to the browser.
- **`lib/`** files may be imported by both Server and Client components; avoid Node-only APIs in files that are imported by Client Components.

---

## 3. Core State: `lib/audio-context.tsx`

This is the most important file in the project. Read it before touching any playback logic.

### 3.1 Provider Mounting

`AudioProvider` is mounted **once** in `app/layout.tsx`. It wraps the entire app so the YouTube IFrame Player persists across client-side navigations.

### 3.2 `AudioContextType` Interface

Defined in `lib/types.ts`. Key fields:

```typescript
// Playback
currentSong: Song | null
isPlaying: boolean
currentTime: number          // seconds, polled every 500 ms
duration: number
volume: number               // 0–100
isLoading: boolean

// Queue
queue: Song[]
queueIndex: number
queueExhausted: boolean
suggestions: Song[]          // shown when queue runs out

// Lyrics
lyrics: LyricLine[]
lyricsLoading: boolean
currentLyricIndex: number

// Effects
crossfadeSecs: number        // 0 = disabled
stopAtTime: number           // 0 = disabled

// Party mode
partyId: string | null
isPartyHost: boolean

// Methods
playSong(song, isManual?, startTime?, stopAt?): void
playNext(): void
playPrev(): void
togglePlayPause(): void
seek(time: number): void
setVolume(vol: number): void
removeFromQueue(idx: number): void
moveInQueue(from: number, to: number): void
```

### 3.3 YouTube IFrame Player Lifecycle

1. `loadYTApi()` (lines 67–83) — dynamically appends the IFrame API script **once**.
2. `loadVideo(videoId, startTime?)` (lines 434–553) — creates or reuses a `YT.Player` on a hidden `div#__yt_player__`. Player config: `controls: 0, disablekb: 1, rel: 0, fs: 0` (audio-only).
3. `onStateChange` handler maps YouTube states → internal `isPlaying` / advance-queue logic.
4. A `setInterval` at 500 ms polls `player.getCurrentTime()` to drive `currentTime`, lyrics sync, crossfade, and stop-at-time.

### 3.4 Queue Invariants — CRITICAL

- **Manual play** (`playSong(song, isManual=true)`) → fetches `/api/musiva/upnext?videoId=` and rebuilds the entire queue.
- **Auto-advance** (`_advanceToSong()`) → does **NOT** re-fetch upnext; traverses existing `queueRef`.
- `queueRef` and `queueIndexRef` are `useRef` values (not state) to avoid stale closures in callbacks. State `queue` and `queueIndex` are mirrors kept in sync for UI rendering.
- Never call `setQueue` directly from outside the context; always go through the exposed methods.

### 3.5 Crossfade

When `remainingTime ≤ crossfadeSecs`, a 200 ms tick loop ramps `ytPlayer.setVolume()` from current to 0. The next song fades in symmetrically. Do not call `setVolume` on the player directly — always use the context's `setVolume()`.

### 3.6 AI Recording Integration

- Every **5 seconds** of playback: `recordListenSeconds(5)` (calls into `lib/local-data.ts`).
- On `playSong()`: if previous song was played < 25 s, it is recorded as a **skip**.
- This data populates the on-device taste profile (`mz_ai_v1` in localStorage).

---

## 4. Persistence: `lib/storage.ts`

1 278-line file with **50+ typed functions**. All reads/writes go through this file — do not call `localStorage.getItem/setItem` directly in components.

### Namespace Groups

| Prefix | Contents |
|---|---|
| `lyrica_*` | Songs: recently played, liked, cached, downloaded, playlists |
| `musicana_*` | Preferences, stats, history, reactions, moments, party IDs, badges |
| `mz_ai_*` | AI toggle flag, signed taste profile |
| `musicanaz_uid` | Anonymous device UUID |
| `musicanaz_party_host_<id>` | Party host secret (never sent to server) |

### Adding New Persistent Data

Follow the existing pattern:

```typescript
const KEY = "musicana_my_feature"

export function getMyFeatureData(): MyType {
  if (typeof window === "undefined") return defaultValue
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : defaultValue
  } catch {
    return defaultValue
  }
}

export function setMyFeatureData(data: MyType): void {
  if (typeof window === "undefined") return
  localStorage.setItem(KEY, JSON.stringify(data))
}
```

Always guard with `typeof window === "undefined"` for SSR safety.

---

## 5. Types: `lib/types.ts`

Core interfaces — always import from here, never redefine inline:

```typescript
interface Song {
  videoId: string
  title: string
  artist: string
  album?: string
  thumbnail: string
  duration?: number
  isVideo?: boolean
}

interface LyricLine {
  time: number   // seconds
  text: string
}

interface MusivaTrack { /* raw API response shape */ }
interface MoodCategory { id: string; name: string; params: string }
interface UpNextQueue { tracks: Song[] }
```

---

## 6. API Route Conventions

All routes live in `app/api/**/route.ts`. Pattern:

```typescript
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q") ?? ""

  const upstream = process.env.MUSIVA_API_URL
  const res = await fetch(`${upstream}/search?q=${encodeURIComponent(q)}`, {
    next: { revalidate: 60 },   // ISR cache where appropriate
  })

  if (!res.ok) return NextResponse.json({ error: "upstream error" }, { status: 502 })
  const data = await res.json()
  return NextResponse.json(data)
}
```

Rules:
- **Never** hard-code upstream URLs — always read from `process.env.*`.
- **Never** expose `process.env` values that lack the `NEXT_PUBLIC_` prefix to the client.
- Return `NextResponse.json(...)` — do not use `Response` directly.
- For long-running proxies (AI analyze), set an explicit `signal: AbortSignal.timeout(90_000)`.

### Route Categories

| Prefix | Backend env var | Purpose |
|---|---|---|
| `/api/musiva/*` | `MUSIVA_API_URL` | All music data and streams |
| `/api/ai/*` | `AI_API_URL` | AI personalization |
| `/api/groq/transform` | `GROQ_API_URL` | LLM translation / transliteration |
| `/api/sponsorblock` | `SPONSORBLOCK_API_URL` | Skip-segment data |
| `/api/party` | *(in-memory)* | Party state (no external backend) |
| `/api/download/*` | `NEXT_PUBLIC_YT_DL_SERVER` | Audio download pipeline |
| `/api/toplay/*` | `NEXT_PUBLIC_TOPLAY_API_URL` | Community trending |

---

## 7. AI Personalisation System

### 7.1 Architecture (Privacy-First)

Raw playback data **never leaves the device**. Only an aggregated, anonymised taste profile is sent to the AI backend.

```
User plays song
  → lib/local-data.ts: recordPlay() → updates mz_ai_v1 in localStorage
  → lib/ai-client.ts: runAIAnalysis() → buildTasteProfile() → POST /api/ai/analyze
  ← Returns { analysis, suggestions } → writeAnalysis() → back to localStorage
```

### 7.2 On-Device Schema (`mz_ai_v1`)

```typescript
{
  _sig: string,           // HMAC with APP_SIG = "musicanaz_2025"
  _version: 1,
  user_id: string,
  songs: Record<songId, {
    play_count: number,
    total_listened_ms: number,
    avg_listen_ratio: number,  // 0–1
    liked: boolean,
    skip_count: number,
    skipped: boolean,          // true if last play was a skip
  }>,
  analysis?: {
    liked_types: string[],
    disliked_types: string[],
    top_artists: string[],
    taste_summary: string,
    suggestions: Song[],
  }
}
```

### 7.3 AI Search Flow

```typescript
// lib/ai-client.ts
async function aiPersonalizedSearch(userId: string, query: string): Promise<Song[]>
// POST /api/ai/search  { user_id, query, limit }
// Returns taste-ranked results merged with standard results
```

Enabled when `localStorage.getItem("mz_ai_enabled") === "true"`.

---

## 8. Party Mode System

### 8.1 Architecture

```
External Party Server (NEXT_PUBLIC_PARTY_SERVER)
  └── Persistent cross-client state: queue, chat, votes, reactions, guests, WebRTC signals

Local API (/api/party)
  └── In-memory state: mirrors party actions, auto-cleans after 3 hours

lib/party-rtc.ts (PartyRTC class)
  └── WebRTC data channels for low-latency chat/reactions
  └── HTTP polling fallback every 2 s if WebRTC unavailable
```

### 8.2 Host vs Guest

- **Host** (`app/party/[id]/host/page.tsx`): Controls playback. `partyHostId` is stored in `localStorage` key `musicanaz_party_host_<partyId>` and **never** sent over the network or exposed in `AudioContextType`.
- **Guest** (`app/party/[id]/page.tsx`): Polls external server every 2 s. Can add songs, vote, chat, react.

### 8.3 Queue Sorting

```typescript
sortedQueue = queue.sort(
  (a, b) => (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes)
         || a.addedAt - b.addedAt   // tie-break: oldest first
)
```

### 8.4 Host Sync Loop (`audio-context.tsx` lines 816–860)

Every 4 s:
1. Fetch party state from external server.
2. Sort queue by score + addedAt.
3. Sync to local `queueRef` (does not trigger upnext re-fetch).
4. POST `currentSong` back to server so guests can display it.

---

## 9. Component Patterns

### 9.1 Consuming Audio Context

```typescript
"use client"
import { useAudio } from "@/lib/audio-context"

export function MyComponent() {
  const { currentSong, isPlaying, playSong, queue } = useAudio()
  // ...
}
```

### 9.2 SongCard Pattern

`components/song-card.tsx` resolves missing `videoId` values (common with Deezer-sourced tracks) before calling `playSong()`:

```typescript
if (!song.videoId) {
  const res = await fetch(`/api/musiva/search?q=${title}+${artist}&limit=1`)
  const { songs } = await res.json()
  song = { ...song, videoId: songs[0]?.videoId }
}
playSong(song)
router.push("/player")
```

Always follow this pattern when adding new entry points to playback.

### 9.3 Styling

```typescript
import { cn } from "@/lib/utils"

// Merge Tailwind classes conditionally:
<div className={cn("base-class", isActive && "active-class", className)} />
```

Never use string concatenation for Tailwind classes — always use `cn()`.

### 9.4 UI Components

Use `components/ui/*` wrappers, not Radix primitives directly:

```typescript
// ✅ correct
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent } from "@/components/ui/dialog"

// ❌ avoid
import * as DialogPrimitive from "@radix-ui/react-dialog"
```

---

## 10. Download Pipeline

Multi-step flow managed through `/api/download/*`:

```
POST /api/download/start   → { uid }
GET  /api/download/status/[uid]  → { status, progress }  (poll until done)
GET  /api/download/file/[uid]    → audio blob
POST /api/download/done/[uid]    → cleanup
GET  /api/download/proxy         → Invidious proxy fallback (no self-hosted server)
```

The `NEXT_PUBLIC_YT_DL_SERVER` env var points to an optional self-hosted yt-dlp server (`download_server.js` / `download_server.py` at repo root). When absent, the proxy fallback is used.

---

## 11. Groq Translation / Transliteration

`POST /api/groq/transform` — model: `llama-3.3-70b-versatile`.

Modes:
- **`transliterate`** — phonetic romanisation (e.g. Hindi → `"mera dil"`, Korean → `"saranghae"`)
- **`translate`** — full translation to a target language

The user's Groq API key is read from `musicana_preferences.groqApiKey` (localStorage) and forwarded in the `Authorization` header by the route. The server's `GROQ_API_URL` env var points to the Groq API base URL.

---

## 12. SponsorBlock Integration

`GET /api/sponsorblock?videoId=<id>` proxies to the SponsorBlock API and returns an array of skip segments `{ startTime, endTime, category }`. The player page checks `currentTime` against these segments and auto-skips when the user has enabled the feature in settings.

---

## 13. Community / ToPlay

Four routes under `/api/toplay/*` plus client helpers in `lib/toplay-client.ts` and `lib/use-toplay-sync.ts`. These are optional (require `NEXT_PUBLIC_TOPLAY_API_URL`). When the env var is absent, the feature silently degrades.

Pattern for optional features:

```typescript
const TOPLAY_API = process.env.NEXT_PUBLIC_TOPLAY_API_URL
if (!TOPLAY_API) return  // feature disabled — fail silently
```

---

## 14. Environment Variables

All variables are listed in `.env.example`. Rules for new variables:

- **Server secrets** (API keys, internal URLs) → no `NEXT_PUBLIC_` prefix → only accessible in `app/api/*` route handlers.
- **Client-safe values** (public URLs, feature flags) → `NEXT_PUBLIC_` prefix → accessible in both server and client code.
- Read environment variables at **module load time** in route handlers — do not read them inside React components.

---

## 15. Common Anti-Patterns to Avoid

| Anti-pattern | Correct alternative |
|---|---|
| `localStorage.getItem(KEY)` directly | Use the typed function from `lib/storage.ts` |
| Hard-coding upstream URLs | Read from `process.env.*` |
| Calling `setQueue()` from outside context | Use `playSong()`, `removeFromQueue()`, `moveInQueue()` |
| String concatenation for Tailwind classes | Use `cn()` from `lib/utils.ts` |
| Fetching `/api/musiva/*` from a Server Component | Fetch the upstream `MUSIVA_API_URL` directly in the route handler |
| Re-fetching upnext on queue auto-advance | Only fetch upnext on **manual** `playSong()` calls |
| Importing Radix primitives directly | Use wrappers in `components/ui/` |
| `window.localStorage` without SSR guard | Always guard with `typeof window === "undefined"` |
| Exposing `partyHostId` via context | Keep it in `localStorage` only; never put it in `AudioContextType` |

---

## 16. Adding a New Feature — Checklist

1. **API route** → `app/api/<feature>/route.ts`; proxy to env-var URL; return `NextResponse.json()`.
2. **Types** → add interfaces to `lib/types.ts` if shared.
3. **Persistence** → add getter/setter pair to `lib/storage.ts` with SSR guard.
4. **Client hook** → consume via `useAudio()` if playback-related, or create a dedicated `use-<feature>.ts` hook in `lib/`.
5. **UI** → use `components/ui/*` primitives; style with `cn()`.
6. **Env var** → document in `.env.example` with a descriptive comment.
7. **Optional features** → fail silently when env var is absent.
