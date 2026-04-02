# Musicanaz

A full-stack music streaming Progressive Web App (PWA) built with **Next.js 16**, **React 19**, and **TypeScript**.  
Stream music, discover new tracks, manage playlists, and listen together with friends — all without creating an account.

---

## Features

| Category | Feature |
|---|---|
| 🎵 **Playback** | YouTube-powered audio playback with crossfade, stop-at-time, and Media Session API (lock-screen controls) |
| 🔍 **Discovery** | Search songs, albums, and artists; trending charts; mood-based playlists; Apple Music & Last.fm charts |
| 🤖 **AI Personalisation** | On-device taste profile — raw data never leaves your device; AI-ranked search and recommendations |
| 📃 **Lyrics** | Timestamped karaoke-style lyrics with transliteration and translation via Groq LLM |
| 📂 **Library** | Liked songs, user-created playlists, play history, listening stats, and badges |
| ⬇️ **Downloads** | Download songs for offline playback via a self-hosted or built-in proxy server |
| 🎉 **Party Mode** | Real-time collaborative listening with WebRTC, vote-sorted queue, emoji reactions, and group chat |
| 🎙️ **Podcasts** | Browse and play podcast episodes |
| ⏭️ **SponsorBlock** | Automatically skip sponsor segments in tracks |
| 🌐 **Community** | Community-driven trending via the optional ToPlay integration |
| 🌙 **Theming** | Dark / light mode with full Tailwind CSS v4 customisation |
| 📱 **PWA** | Installable on desktop and mobile; offline banner for network-loss detection |

---

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19 + Radix UI + shadcn/ui + Tailwind CSS v4
- **Language:** TypeScript 5 (strict mode)
- **State:** React Context API + localStorage (no Redux)
- **Package manager:** pnpm

---
## Before you start
- Access the hosted version on https://musicanaz.vercel.app/
- You can use any browser to access `Musicanaz` 
  
## Getting Started

### Prerequisites

- Node.js ≥ 18
- pnpm (`npm install -g pnpm`)

### 1 — Clone

```bash
git clone https://github.com/Wilooper/Musicanaz.git
cd Musicanaz
```

### 2 — Install Dependencies

```bash
pnpm install
```

### 3 — Configure Environment Variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in the required values. See `.env.example` for descriptions of each variable.

### 4 — Run in Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5 — Build for Production

```bash
pnpm build
pnpm start
```

---

## Project Structure

See [Project_structure.md](./Project_structure.md) for the full annotated directory tree.

---

## Optional: Self-Hosted Download Server

A lightweight yt-dlp download server is included at the repo root:

```bash
# Node.js version
node download_server.js

# Python version
python download_server.py
```

Set `NEXT_PUBLIC_YT_DL_SERVER` in your `.env.local` to the server's URL to enable it.

---

## Contribution Guidelines

Contributions are welcome! Please follow these steps:

1. **Fork** the repository.
2. **Create a branch** for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes** and ensure existing behaviour is not broken.
4. **Commit** with a clear message:
   ```bash
   git commit -m "feat: describe your change"
   ```
5. **Push** your branch and open a **Pull Request** against `main`.

For AI-assisted contributions, refer to [README_FOR_AI.md](./README_FOR_AI.md) for architecture details and coding conventions.

---

## License

This project is licensed under the **MIT License**. See [LICENSE](./LICENSE) for details.

---

### Contact

For any inquiries, please contact the project maintainer at [thinkelyorg@gmail.com].
