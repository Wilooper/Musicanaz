export const viewport = {
  themeColor: "#09090b",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
}

import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AudioProvider } from "@/lib/audio-context"
import MiniPlayer from "@/components/mini-player"
import OfflineBanner from "@/components/offline-banner"
import "./globals.css"
import Script from "next/script"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

const BASE_URL    = "https://musicanaz.vercel.app"
const LOGO_URL    = "https://raw.githubusercontent.com/wilooper/Asset/main/logo.png"
const SITE_NAME   = "Musicanaz"
const DESCRIPTION =
  "Musicanaz — stream millions of songs free with real-time synced lyrics, " +
  "discover trending charts from 15+ countries, explore moods & genres, " +
  "save playlists to your library, and listen to podcasts — all in one beautiful PWA."

export const metadata: Metadata = {
  /* ── Core ───────────────────────────────────────────────── */
  metadataBase:  new URL(BASE_URL),
  title: {
    default:  `${SITE_NAME} — Free Music Streaming with Lyrics`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  keywords: [
    "music streaming", "free music", "stream music online",
    "synced lyrics", "music player", "trending songs",
    "YouTube Music", "music charts", "podcasts",
    "playlist", "music discovery", "PWA music app",
    "listen music free", "song lyrics", "music app",
  ],
  authors:   [{ name: SITE_NAME, url: BASE_URL }],
  creator:   SITE_NAME,
  publisher: SITE_NAME,
  category:  "music",
  generator: "Next.js",
  manifest:  "/manifest.json",

  /* ── Canonical & alternates ─────────────────────────────── */
  alternates: {
    canonical: BASE_URL,
  },

  /* ── Open Graph ─────────────────────────────────────────── */
  openGraph: {
    type:        "website",
    url:         BASE_URL,
    siteName:    SITE_NAME,
    title:       `${SITE_NAME} — Free Music Streaming with Synced Lyrics`,
    description: DESCRIPTION,
    images: [
      {
        url:    LOGO_URL,
        width:  1200,
        height: 630,
        alt:    `${SITE_NAME} — Stream Music Free`,
      },
    ],
    locale: "en_US",
  },

  /* ── Twitter / X card ───────────────────────────────────── */
  twitter: {
    card:        "summary_large_image",
    site:        "@musicanaz_app",
    creator:     "@musicanaz_app",
    title:       `${SITE_NAME} — Free Music Streaming with Synced Lyrics`,
    description: DESCRIPTION,
    images:      [LOGO_URL],
  },

  /* ── Apple PWA ──────────────────────────────────────────── */
  appleWebApp: {
    capable:         true,
    statusBarStyle:  "black-translucent",
    title:           SITE_NAME,
    startupImage:    [{ url: LOGO_URL }],
  },

  /* ── Icons ──────────────────────────────────────────────── */
  icons: {
    icon:     [
      { url: LOGO_URL, type: "image/png", sizes: "192x192" },
      { url: LOGO_URL, type: "image/png", sizes: "512x512" },
    ],
    apple:    { url: LOGO_URL, type: "image/png" },
    shortcut: LOGO_URL,
  },

  /* ── Robots ─────────────────────────────────────────────── */
  robots: {
    index:          true,
    follow:         true,
    googleBot: {
      index:             true,
      follow:            true,
      "max-video-preview":  -1,
      "max-image-preview":  "large",
      "max-snippet":        -1,
    },
  },

  /* ── Verification (fill in once you verify in Search Console) */
  // verification: {
  //   google: "YOUR_GOOGLE_VERIFICATION_TOKEN",
  //   yandex: "YOUR_YANDEX_TOKEN",
  // },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
        {/* Android Chrome: hint that media played here is audio, not video.
            Also prevents the browser from sniffing content-type which can
            cause the YouTube iframe to be treated as a video player. */}
        <meta httpEquiv="x-content-type-options" content="nosniff" />
        {/* JSON-LD structured data for Google */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebApplication",
                  "@id":   `${BASE_URL}/#webapp`,
                  "name":  SITE_NAME,
                  "url":   BASE_URL,
                  "description": DESCRIPTION,
                  "applicationCategory": "MultimediaApplication",
                  "operatingSystem": "Any",
                  "browserRequirements": "Requires JavaScript",
                  "offers": {
                    "@type": "Offer",
                    "price": "0",
                    "priceCurrency": "USD",
                  },
                  "featureList": [
                    "Free music streaming",
                    "Real-time synchronized lyrics",
                    "Trending charts from 15+ countries",
                    "Mood & genre playlists",
                    "Personal music library",
                    "Podcast streaming",
                    "Party mode with shared queue",
                    "Offline PWA support",
                  ],
                },
                {
                  "@type": "Organization",
                  "@id":   `${BASE_URL}/#org`,
                  "name":  SITE_NAME,
                  "url":   BASE_URL,
                  "logo": {
                    "@type":  "ImageObject",
                    "url":    LOGO_URL,
                    "width":  512,
                    "height": 512,
                  },
                },
                {
                  "@type":       "WebSite",
                  "@id":         `${BASE_URL}/#website`,
                  "url":         BASE_URL,
                  "name":        SITE_NAME,
                  "description": DESCRIPTION,
                  "publisher":   { "@id": `${BASE_URL}/#org` },
                  "potentialAction": {
                    "@type":       "SearchAction",
                    "target": {
                      "@type":       "EntryPoint",
                      "urlTemplate": `${BASE_URL}/?q={search_term_string}`,
                    },
                    "query-input": "required name=search_term_string",
                  },
                },
              ],
            }),
          }}
        />
        <AudioProvider>
          <OfflineBanner />
          {children}
          <MiniPlayer />
        </AudioProvider>
        <Analytics />
        <script
          dangerouslySetInnerHTML={{
            __html: `if ('serviceWorker' in navigator) {
              window.addEventListener('load', function() {
                navigator.serviceWorker.register('/sw.js').catch(function() {});
              });
            }`,
          }}
        />
      
        {/* ── Google Analytics ── */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-NCNJNYM5J8"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-NCNJNYM5J8');
          `}
        </Script>
      </body>
    </html>
  )
}
