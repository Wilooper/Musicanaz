// This route is intentionally minimal.
// Actual downloads go through:
//   Tier 1: /api/download/proxy  (Invidious → edge proxy)
//   Tier 2: user's self-hosted musicanaz-downloader.js server
// See app/player/page.tsx handleDownload for the full flow.
import { NextResponse } from "next/server"
export async function GET() {
  return NextResponse.json({
    info: "Use /api/download/proxy for Invidious-sourced downloads, or configure a download server in Settings.",
  })
}
