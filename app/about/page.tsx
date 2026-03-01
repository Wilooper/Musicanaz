"use client"

import { useRouter } from "next/navigation"
import { Music, Github, Instagram, ArrowLeft, Heart, Download, ListMusic, Mic2, Code2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function AboutPage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      <div className="container mx-auto px-4 py-8 pb-32">
        {/* Header */}
        <div className="flex items-center gap-4 mb-12">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
              <Music className="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-bold text-foreground">About Musicanaz</h1>
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-8">
          {/* About the App */}
          <Card>
            <CardHeader>
              <CardTitle>About the Application</CardTitle>
              <CardDescription>Your ultimate music streaming companion</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-foreground leading-relaxed">
                Musicanaz is a modern, feature-rich music streaming application designed to provide you with the best
                music listening experience. Stream millions of songs, view synchronized lyrics, and enjoy your favorite
                tracks anytime, anywhere.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <div className="flex items-start gap-3 p-4 bg-accent/20 rounded-lg">
                  <Mic2 className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Synchronized Lyrics</h3>
                    <p className="text-sm text-muted-foreground">
                      Follow along with real-time, time-synced lyrics as you listen
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-accent/20 rounded-lg">
                  <Heart className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Like & Save</h3>
                    <p className="text-sm text-muted-foreground">
                      Build your personal collection of favorite songs and playlists
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-accent/20 rounded-lg">
                  <Download className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Offline Playback</h3>
                    <p className="text-sm text-muted-foreground">
                      Download songs for offline listening and automatic caching
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-4 bg-accent/20 rounded-lg">
                  <ListMusic className="w-5 h-5 text-primary mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">Custom Playlists</h3>
                    <p className="text-sm text-muted-foreground">Create and manage your own playlists with ease</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* About the Developer */}
          <Card>
            <CardHeader>
              <CardTitle>About the Developer</CardTitle>
              <CardDescription>Meet the creator behind Musicanaz</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary-foreground">SS</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground">Shaurya Singh</h3>
                  <p className="text-muted-foreground">Backend Developer & Music Enthusiast</p>
                </div>
              </div>

              <p className="text-foreground leading-relaxed">
                Hi! I'm Shaurya Singh, a passionate backend developer who specializes in building robust APIs and music
                streaming infrastructure. I developed the entire backend system for Musicanaz, including the music
                streaming API, caching system, and data management.
              </p>

              <div className="p-4 bg-accent/20 rounded-lg border border-accent/30">
                <div className="flex items-start gap-3">
                  <Code2 className="w-5 h-5 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-2">Development Note</h4>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      <strong>Backend:</strong> Developed by Shaurya Singh - Custom music streaming API with smart
                      caching, song metadata management, and optimized audio delivery.
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                      <strong>Frontend:</strong> Built with v0 by Vercel - The entire user interface, design system, and
                      frontend implementation was created using v0's AI-powered development platform.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                  onClick={() => window.open("https://github.com/Wilooper", "_blank")}
                >
                  <Github className="w-5 h-5" />
                  GitHub: Wilooper
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2 bg-transparent"
                  onClick={() => window.open("https://instagram.com/shaurya_singh_.7", "_blank")}
                >
                  <Instagram className="w-5 h-5" />
                  Instagram: shaurya_singh_.7
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Technical Details */}
          <Card>
            <CardHeader>
              <CardTitle>Technical Details</CardTitle>
              <CardDescription>Built with modern technologies</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3 text-sm text-muted-foreground">Frontend Stack</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-accent/20 rounded-lg text-center">
                      <p className="font-semibold">Next.js 16</p>
                      <p className="text-xs text-muted-foreground">Framework</p>
                    </div>
                    <div className="p-3 bg-accent/20 rounded-lg text-center">
                      <p className="font-semibold">React 19</p>
                      <p className="text-xs text-muted-foreground">UI Library</p>
                    </div>
                    <div className="p-3 bg-accent/20 rounded-lg text-center">
                      <p className="font-semibold">TypeScript</p>
                      <p className="text-xs text-muted-foreground">Language</p>
                    </div>
                    <div className="p-3 bg-accent/20 rounded-lg text-center">
                      <p className="font-semibold">Tailwind CSS</p>
                      <p className="text-xs text-muted-foreground">Styling</p>
                    </div>
                    <div className="p-3 bg-accent/20 rounded-lg text-center">
                      <p className="font-semibold">shadcn/ui</p>
                      <p className="text-xs text-muted-foreground">Components</p>
                    </div>
                    <div className="p-3 bg-accent/20 rounded-lg text-center">
                      <p className="font-semibold">v0 by Vercel</p>
                      <p className="text-xs text-muted-foreground">Development</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3 text-sm text-muted-foreground">Backend Stack</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="p-3 bg-accent/20 rounded-lg text-center">
                      <p className="font-semibold">Musiva API</p>
                      <p className="text-xs text-muted-foreground">Music Streaming</p>
                    </div>
                    <div className="p-3 bg-accent/20 rounded-lg text-center">
                      <p className="font-semibold">Smart Caching</p>
                      <p className="text-xs text-muted-foreground">Performance</p>
                    </div>
                    <div className="p-3 bg-accent/20 rounded-lg text-center">
                      <p className="font-semibold">Local Storage</p>
                      <p className="text-xs text-muted-foreground">Offline Data</p>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Version & Credits */}
          <div className="text-center space-y-2 pt-8 pb-4">
            <p className="text-sm text-muted-foreground">Musicanaz v1.0.0</p>
            <p className="text-xs text-muted-foreground">
              Made with <Heart className="w-3 h-3 inline text-red-500 fill-red-500" /> by Shaurya Singh
            </p>
            <p className="text-xs text-muted-foreground">© 2025 Musicanaz. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
