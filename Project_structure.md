# Musicanaz — Project Structure

> Complete annotated directory and file tree.  
> All paths are relative to the repository root.

---

## Root

```
Musicanaz/
├── .env.example              # Environment variable template (copy → .env.local)
├── .gitignore
├── components.json           # shadcn/ui component registry config
├── download_server.js        # Optional self-hosted yt-dlp download server (Node)
├── download_server.py        # Optional self-hosted yt-dlp download server (Python)
├── Just_for_fun.md           # Miscellaneous notes
├── LICENSE                   # MIT License
├── next.config.mjs           # Next.js configuration
├── package.json              # NPM manifest (52 prod deps, 7 dev deps)
├── pnpm-lock.yaml            # pnpm lockfile
├── postcss.config.mjs        # PostCSS config (Tailwind v4)
├── Project_structure.md      # ← this file
├── README.md                 # User-facing readme
├── README_FOR_AI.md          # Technical reference for AI assistants
└── tsconfig.json             # TypeScript config (strict mode)
```

---

## `app/` — Next.js App Router

```
app/
├── layout.tsx                # Root layout; mounts <AudioProvider>, theme, analytics
├── page.tsx                  # Home / search page (1 758 lines)
├── globals.css               # Global CSS reset + Tailwind base
├── robots.ts                 # SEO: robots.txt generation
├── sitemap.ts                # SEO: sitemap.xml generation
├── loading.tsx               # Global Suspense skeleton
│
├── about/
│   └── page.tsx              # About / credits page
│
├── album/
│   └── page.tsx              # Album detail view (172 lines)
│
├── artist/
│   └── page.tsx              # Artist profile + top songs (371 lines)
│
├── collab/
│   └── [id]/
│       └── page.tsx          # Shared listening / collaboration room (523 lines)
│
├── history/
│   └── page.tsx              # Play history, stats, heatmap (647 lines)
│
├── library/
│   └── page.tsx              # User library: liked songs, playlists (542 lines)
│
├── moods/
│   └── page.tsx              # Mood-based playlist browser (253 lines)
│
├── note/
│   └── page.tsx              # Notes / collab creation (477 lines)
│
├── party/
│   └── [id]/
│       ├── page.tsx          # Party mode — guest view (867 lines)
│       └── host/
│           └── page.tsx      # Party mode — host view (632 lines)
│
├── player/
│   ├── page.tsx              # Full music player (2 602 lines)
│   └── loading.tsx           # Player loading skeleton
│
├── playlist/
│   └── page.tsx              # Playlist detail / management (195 lines)
│
├── podcast/
│   └── page.tsx              # Podcast episode browser (203 lines)
│
├── settings/
│   └── page.tsx              # User preferences & configuration (1 134 lines)
│
└── song/
    └── page.tsx              # Single song detail page (87 lines)
```

### `app/api/` — API Route Handlers (47 routes total)

```
app/api/
│
├── ai/                       # AI personalization (7 routes)
│   ├── analyze/route.ts      # POST: send taste profile → receive analysis
│   ├── event/route.ts        # POST: log user event for model improvement
│   ├── recommend/route.ts    # POST: personalized song recommendations
│   ├── recommendations/route.ts  # GET: alternative recommendations endpoint
│   ├── search/route.ts       # POST: taste-ranked search results
│   ├── signals/route.ts      # GET: AI signal tracking (skip detection, etc.)
│   └── similar/route.ts      # GET: songs similar to a given track
│
├── collab/
│   └── route.ts              # POST: create / join collaboration session
│
├── download/                 # Audio download pipeline (6 routes)
│   ├── route.ts              # GET: download info / status endpoint
│   ├── done/[uid]/route.ts   # POST: mark download session complete
│   ├── file/[uid]/route.ts   # GET: retrieve downloaded audio file
│   ├── proxy/route.ts        # GET: proxy audio through server (Invidious fallback)
│   ├── start/route.ts        # POST: initiate download session → returns uid
│   └── status/[uid]/route.ts # GET: poll download progress
│
├── groq/
│   └── transform/route.ts    # POST: Groq Llama-3.3-70B transliteration / translation
│
├── musiva/                   # Music data proxy (25+ routes)
│   ├── album/route.ts        # GET: album tracks by ID
│   ├── apple-music/
│   │   ├── top-albums/route.ts  # GET: Apple Music top albums
│   │   └── top-songs/route.ts   # GET: Apple Music top songs
│   ├── artist/route.ts       # GET: artist info by ID
│   ├── artist-albums/route.ts # GET: artist's discography
│   ├── artist-songs/route.ts  # GET: artist's top songs
│   ├── charts/route.ts       # GET: chart data
│   ├── explore/route.ts      # GET: explore collections
│   ├── home/route.ts         # GET: home feed
│   ├── lastfm/
│   │   ├── artists/route.ts  # GET: Last.fm top artists
│   │   └── charts/route.ts   # GET: Last.fm charts
│   ├── lyrics-by-video/route.ts  # GET: timestamped lyrics by videoId
│   ├── mood/route.ts         # GET: mood-based playlist content
│   ├── now-playing/route.ts  # GET: currently playing track info
│   ├── play/[videoId]/route.ts   # GET: resolve playlist or single song
│   ├── playlist/route.ts     # GET: playlist tracks by ID
│   ├── podcast/route.ts      # GET: podcast episode list
│   ├── related-songs/route.ts # GET: tracks related to a song
│   ├── search/route.ts       # GET: search songs, albums, artists
│   ├── song/route.ts         # GET: song metadata by ID
│   ├── stream/[videoId]/route.ts # GET: audio stream URL + format
│   ├── suggestions/route.ts  # GET: search-as-you-type suggestions
│   ├── top-playlists/route.ts # GET: top curated playlists
│   ├── trending/route.ts     # GET: trending songs
│   ├── upnext/route.ts       # GET/DELETE: auto-queue next songs
│   └── video/search/route.ts # GET: YouTube video search
│
├── party/
│   └── route.ts              # GET/POST: in-memory party state management
│
├── sponsorblock/
│   └── route.ts              # GET: skip-segment data for a videoId
│
├── toplay/                   # Community trending (4 routes)
│   ├── status/route.ts       # GET: community service status
│   ├── submit/route.ts       # POST: submit a play to community list
│   └── trending/
│       ├── artists/route.ts  # GET: community top artists
│       └── songs/route.ts    # GET: community top songs
│
└── trending/
    └── route.ts              # GET: aggregate trending from multiple sources
```

---

## `components/` — React Components

```
components/
├── image-with-fallback.tsx   # <img> wrapper that shows a placeholder on error
├── mini-player.tsx           # Fixed bottom playback bar (progress, play/pause, skip)
├── offline-banner.tsx        # Banner shown when the browser goes offline
├── share-card-generator.tsx  # Generates OG-style shareable song/playlist cards
├── song-card.tsx             # Clickable song tile; resolves missing videoIds
├── theme-provider.tsx        # next-themes dark/light mode context
├── wrapped-card.tsx          # Year-in-review "Wrapped" summary card
│
└── ui/                       # Radix UI + shadcn primitives (15+ files)
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    ├── drawer.tsx
    ├── input.tsx
    ├── label.tsx
    ├── slider.tsx
    ├── tabs.tsx
    └── ...                   # badge, checkbox, select, separator, skeleton, etc.
```

---

## `lib/` — Shared Utilities & State

```
lib/
├── ai-client.ts              # AI feature client (94 lines)
│                             #   getAISearchEnabled(), setAISearchEnabled()
│                             #   runAIAnalysis(), getAIRecommendations()
│                             #   aiPersonalizedSearch(), localRecordPlay()
│
├── audio-context.tsx         # Core audio playback state provider (1 022 lines)
│                             #   AudioProvider (React Context)
│                             #   useAudio() hook
│                             #   YouTube IFrame Player lifecycle
│                             #   Queue, crossfade, lyrics sync, Media Session API
│
├── hooks.ts                  # Generic React hooks (20 lines)
│                             #   useMediaQuery()
│
├── local-data.ts             # On-device AI taste profile (191 lines)
│                             #   initLocalData(), recordPlay()
│                             #   buildTasteProfile(), writeAnalysis()
│                             #   Storage key: mz_ai_v1
│
├── party-rtc.ts              # WebRTC party mode (289 lines)
│                             #   PartyRTC class
│                             #   pollSignals(), broadcast(), handleSignal()
│                             #   createPeerEntry() with STUN/TURN ICE servers
│
├── storage.ts                # localStorage management (1 278 lines)
│                             #   50+ typed getter/setter functions
│                             #   Namespaces: lyrica_*, musicana_*, mz_ai_*
│
├── toplay-client.ts          # Community ToPlay API wrapper
├── toplay-sync.ts            # ToPlay sync logic
├── toplay-types.ts           # ToPlay TypeScript interfaces
├── types.ts                  # Shared TypeScript interfaces (104 lines)
│                             #   Song, MusivaTrack, LyricLine
│                             #   MoodCategory, UpNextQueue, AudioContextType
│
├── uid.ts                    # Anonymous user identity (17 lines)
│                             #   getOrCreateUID() — crypto.randomUUID()
│                             #   Storage key: musicanaz_uid
│
├── use-toplay-sync.ts        # React hook for ToPlay sync
└── utils.ts                  # Utility functions (7 lines)
                              #   cn() — clsx + tailwind-merge
```

---

## `public/` — Static Assets

```
public/
└── ...                       # Icons, PWA manifest, og-images, etc.
```

---

## Key Configuration Files

| File | Purpose |
|---|---|
| `next.config.mjs` | Next.js 16 config (image domains, headers, etc.) |
| `tsconfig.json` | TypeScript strict mode, path aliases (`@/*`) |
| `postcss.config.mjs` | PostCSS with `@tailwindcss/postcss` v4 |
| `components.json` | shadcn/ui registry (style, aliases, Tailwind) |
| `.env.example` | Template for all environment variables |
| `package.json` | 52 production + 7 dev dependencies |

---

## Storage Key Reference

| Key | Location | Contents |
|---|---|---|
| `musicanaz_uid` | localStorage | Anonymous user UUID |
| `lyrica_recently_played` | localStorage | Recently played songs |
| `lyrica_liked_songs` | localStorage | Liked / favourited songs |
| `lyrica_cached_songs` | localStorage | Cached audio URLs |
| `lyrica_downloaded_songs` | localStorage | Locally downloaded songs |
| `lyrica_playlists` | localStorage | User-created playlists |
| `musicana_preferences` | localStorage | Theme, language, Groq key, crossfade, etc. |
| `musicana_listen_stats` | localStorage | Daily / weekly listening time |
| `musicana_song_history` | localStorage | Full play history |
| `musicana_reactions` | localStorage | Per-song emoji reactions |
| `musicana_fav_moments` | localStorage | Saved timestamps ("favourite moments") |
| `musicana_party_username` | localStorage | Display name for party mode |
| `musicana_guest_id` | localStorage | Random guest ID for party mode |
| `musicana_collab_refs` | localStorage | Collaboration session references |
| `musicana_badge_events` | localStorage | Badge event log |
| `musicana_badge_earned` | localStorage | Earned badges |
| `mz_ai_enabled` | localStorage | AI personalisation toggle |
| `mz_ai_v1` | localStorage | AI taste profile (HMAC-signed JSON) |
| `musicanaz_party_host_<id>` | localStorage | Host secret for a party session |
