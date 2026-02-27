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

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "MUSICANA — Stream Music",
  description: "Stream music with synchronized lyrics, discover podcasts, and explore charts — powered by YouTube Music.",
  generator: "v0.app",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MUSICANA",
  },
  icons: {
    icon: [
      { url: "https://raw.githubusercontent.com/wilooper/Asset/main/logo.png", type: "image/png" },
    ],
    apple: { url: "https://raw.githubusercontent.com/wilooper/Asset/main/logo.png", type: "image/png" },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased`}>
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
      </body>
    </html>
  )
}
