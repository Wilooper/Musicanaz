"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Heart, Download, ListMusic, Trash2,
  Play, Shuffle, ChevronLeft, Music, Plus,
  Upload, Share, Users, Link2, Copy, Check,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog"
import SongCard from "@/components/song-card"
import ImageWithFallback from "@/components/image-with-fallback"
import {
  getLikedSongs, getDownloadedSongs, getPlaylists,
  deletePlaylist, removeSongFromPlaylist,
  createPlaylist, exportPlaylist, importPlaylist,
  getCollabRefs, saveCollabRef, removeCollabRef, getGuestId, getPartyUsername,
  type CollabRef,
} from "@/lib/storage"
import { useAudio } from "@/lib/audio-context"
import type { Song } from "@/lib/types"
import type { Playlist, DownloadedSong } from "@/lib/storage"
import { addToRecentlyPlayed } from "@/lib/storage"

export default function LibraryPage() {
  const router = useRouter()
  const { playPlaylist, playSong } = useAudio()

  const [likedSongs,       setLikedSongs]       = useState<Song[]>([])
  const [downloadedSongs,  setDownloadedSongs]  = useState<DownloadedSong[]>([])
  const [playlists,        setPlaylists]        = useState<Playlist[]>([])
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)
  const [showNewDlg,       setShowNewDlg]       = useState(false)
  const [newName,          setNewName]          = useState("")
  const [collabRefs,       setCollabRefs]       = useState<CollabRef[]>([])
  const [collabName,       setCollabName]       = useState("")
  const [collabLoading,    setCollabLoading]    = useState(false)
  const [joinCode,         setJoinCode]         = useState("")
  const [copiedId,         setCopiedId]         = useState<string | null>(null)

  useEffect(() => { loadData() }, [])

  const loadData = () => {
    setLikedSongs(getLikedSongs())
    setDownloadedSongs(getDownloadedSongs())
    setPlaylists(getPlaylists())
    setCollabRefs(getCollabRefs())
  }

  const handleDeletePlaylist = (playlistId: string) => {
    if (!confirm("Delete this playlist?")) return
    deletePlaylist(playlistId)
    loadData()
    setSelectedPlaylist(null)
  }

  const handleRemoveSong = (playlistId: string, songId: string) => {
    removeSongFromPlaylist(playlistId, songId)
    // Refresh selected playlist inline
    const updated = getPlaylists().find(p => p.id === playlistId) || null
    setSelectedPlaylist(updated)
    loadData()
  }

  const handleCreatePlaylist = () => {
    if (!newName.trim()) return
    createPlaylist(newName.trim())
    setNewName(""); setShowNewDlg(false)
    loadData()
  }

  const handleExport = (playlistId: string) => {
    exportPlaylist(playlistId)
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const data = event.target?.result as string
      const imported = importPlaylist(data)
      if (imported) {
        loadData()
      } else {
        alert("Failed to import playlist. Invalid file format.")
      }
    }
    reader.readAsText(file)
    e.target.value = "" // Reset
  }

  // Play a playlist starting from a given song index (default 0)
  const handlePlayPlaylist = (pl: Playlist, startIdx = 0, shuffle = false) => {
    if (!pl.songs.length) return
    const songs = shuffle
      ? [...pl.songs].sort(() => Math.random() - 0.5)
      : pl.songs
    songs.forEach(s => addToRecentlyPlayed(s))
    playPlaylist(songs, shuffle ? 0 : startIdx)
    router.push(
      `/player?id=${encodeURIComponent(songs[shuffle ? 0 : startIdx].id)}&title=${encodeURIComponent(songs[shuffle ? 0 : startIdx].title)}&artist=${encodeURIComponent(songs[shuffle ? 0 : startIdx].artist)}&thumbnail=${encodeURIComponent(songs[shuffle ? 0 : startIdx].thumbnail)}&type=musiva&videoId=${encodeURIComponent(songs[shuffle ? 0 : startIdx].videoId || "")}`
    )
  }

  const EmptyState = ({ icon: Icon, text }: { icon: any; text: string }) => (
    <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
      <Icon className="w-12 h-12 opacity-20" />
      <p className="text-sm">{text}</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/10">
      <div className="container mx-auto px-4 py-6 pb-36 max-w-6xl">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => router.push("/")} className="rounded-full">
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">Your Library</h1>
        </div>

        <Tabs defaultValue="playlists" className="w-full">
          {/* Tab list */}
          <TabsList className="flex w-full overflow-x-auto mb-6 h-auto p-1 gap-1 justify-start">
            <TabsTrigger value="playlists" className="rounded-full px-4 py-1.5 text-sm flex-shrink-0 gap-1.5">
              <ListMusic className="w-3.5 h-3.5" />Playlists
            </TabsTrigger>
            <TabsTrigger value="liked" className="rounded-full px-4 py-1.5 text-sm flex-shrink-0 gap-1.5">
              <Heart className="w-3.5 h-3.5" />Liked
            </TabsTrigger>
            <TabsTrigger value="downloads" className="rounded-full px-4 py-1.5 text-sm flex-shrink-0 gap-1.5">
              <Download className="w-3.5 h-3.5" />Downloads
            </TabsTrigger>
            <TabsTrigger value="collab" className="rounded-full px-4 py-1.5 text-sm flex-shrink-0 gap-1.5">
              <Users className="w-3.5 h-3.5" />Collab
            </TabsTrigger>
          </TabsList>

          {/* ── PLAYLISTS ── */}
          <TabsContent value="playlists">
            {selectedPlaylist ? (
              /* Playlist detail view */
              <div>
                {/* Playlist header */}
                <div className="flex items-start gap-4 mb-6">
                  {/* Thumbnail mosaic */}
                  <div className="w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden bg-muted flex-shrink-0 grid grid-cols-2 gap-px">
                    {selectedPlaylist.songs.slice(0, 4).map((s, i) => (
                      <div key={i} className="bg-muted overflow-hidden">
                        {s.thumbnail
                          ? <img src={s.thumbnail} alt="" className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center bg-primary/10"><Music className="w-4 h-4 text-primary/40" /></div>
                        }
                      </div>
                    ))}
                    {selectedPlaylist.songs.length === 0 && (
                      <div className="col-span-2 row-span-2 flex items-center justify-center"><Music className="w-8 h-8 text-muted-foreground/30" /></div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <Button variant="ghost" size="sm" className="mb-1 -ml-2 text-muted-foreground" onClick={() => setSelectedPlaylist(null)}>
                          <ChevronLeft className="w-4 h-4 mr-1" />All playlists
                        </Button>
                        <h2 className="text-xl sm:text-2xl font-bold truncate">{selectedPlaylist.name}</h2>
                        {selectedPlaylist.description && (
                          <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{selectedPlaylist.description}</p>
                        )}
                        <p className="text-sm text-muted-foreground mt-1">{selectedPlaylist.songs.length} songs</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleExport(selectedPlaylist.id)}
                          className="text-muted-foreground hover:text-primary flex-shrink-0 rounded-full"
                          title="Export Playlist"
                        >
                          <Share className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          onClick={() => handleDeletePlaylist(selectedPlaylist.id)}
                          className="text-muted-foreground hover:text-red-400 flex-shrink-0 rounded-full"
                          title="Delete Playlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Play / Shuffle buttons */}
                    {selectedPlaylist.songs.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        <Button
                          onClick={() => handlePlayPlaylist(selectedPlaylist, 0, false)}
                          className="rounded-full gap-2 flex-1 sm:flex-none"
                          size="sm"
                        >
                          <Play className="w-4 h-4" fill="currentColor" />Play All
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => handlePlayPlaylist(selectedPlaylist, 0, true)}
                          className="rounded-full gap-2 flex-1 sm:flex-none"
                          size="sm"
                        >
                          <Shuffle className="w-4 h-4" />Shuffle
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Track list */}
                {selectedPlaylist.songs.length > 0 ? (
                  <div>
                    <div className="hidden sm:grid grid-cols-[auto_1fr_auto] gap-4 px-4 py-2 text-xs text-muted-foreground uppercase tracking-wider border-b border-border/30 mb-1">
                      <span className="w-7 text-center">#</span>
                      <span>Title</span>
                      <span></span>
                    </div>
                    {selectedPlaylist.songs.map((song, idx) => (
                      <div
                        key={`${song.id}-${idx}`}
                        className="group flex items-center gap-3 px-2 sm:px-4 py-2.5 rounded-xl hover:bg-card/50 transition-colors"
                      >
                        {/* Index / play icon */}
                        <div
                          className="w-7 text-center flex-shrink-0 cursor-pointer"
                          onClick={() => handlePlayPlaylist(selectedPlaylist, idx, false)}
                        >
                          <span className="text-sm text-muted-foreground group-hover:hidden">{idx + 1}</span>
                          <Play className="w-4 h-4 text-primary hidden group-hover:inline" fill="currentColor" />
                        </div>

                        {/* Thumbnail */}
                        <div
                          className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex-shrink-0 cursor-pointer"
                          onClick={() => handlePlayPlaylist(selectedPlaylist, idx, false)}
                        >
                          <ImageWithFallback
                            src={song.thumbnail}
                            alt={song.title}
                            className="w-full h-full object-cover"
                            fallback={<div className="w-full h-full flex items-center justify-center"><Music className="w-4 h-4 text-muted-foreground/40" /></div>}
                          />
                        </div>

                        {/* Info */}
                        <div
                          className="flex-1 min-w-0 cursor-pointer"
                          onClick={() => handlePlayPlaylist(selectedPlaylist, idx, false)}
                        >
                          <p className="text-sm font-semibold truncate">{song.title}</p>
                          <p className="text-xs text-muted-foreground truncate">{song.artist}</p>
                        </div>

                        {/* Duration */}
                        {song.duration && (
                          <span className="text-xs text-muted-foreground flex-shrink-0 hidden sm:block tabular-nums">
                            {song.duration}
                          </span>
                        )}

                        {/* Remove */}
                        <button
                          onClick={() => handleRemoveSong(selectedPlaylist.id, song.id)}
                          className="flex-shrink-0 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-400 hover:bg-red-400/10 transition-all"
                          aria-label="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-16 text-muted-foreground">
                    <Music className="w-10 h-10 opacity-20 mx-auto mb-3" />
                    <p className="text-sm">No songs yet — add them from the player</p>
                  </div>
                )}
              </div>
            ) : (
              /* Playlists grid */
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-muted-foreground">{playlists.length} playlists</h2>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleImport}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        title="Import Playlist"
                      />
                      <Button size="sm" variant="outline" className="rounded-full gap-1.5 pointer-events-none">
                        <Upload className="w-3.5 h-3.5" />Import
                      </Button>
                    </div>
                    <Button size="sm" onClick={() => setShowNewDlg(true)} className="rounded-full gap-1.5">
                      <Plus className="w-3.5 h-3.5" />New
                    </Button>
                  </div>
                </div>
                {playlists.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {playlists.map(pl => {
                      const cover = pl.songs.find(s => s.thumbnail)?.thumbnail
                      return (
                        <div
                          key={pl.id}
                          onClick={() => setSelectedPlaylist(pl)}
                          className="group flex items-center gap-3 p-3 rounded-2xl bg-card/40 hover:bg-card/70 border border-border/30 hover:border-border/60 cursor-pointer transition-all hover:scale-[1.01]"
                        >
                          {/* Cover art */}
                          <div className="w-14 h-14 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                            {cover
                              ? <img src={cover} alt="" className="w-full h-full object-cover" />
                              : <div className="w-full h-full flex items-center justify-center bg-primary/10"><ListMusic className="w-6 h-6 text-primary/40" /></div>
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold truncate">{pl.name}</p>
                            <p className="text-xs text-muted-foreground">{pl.songs.length} songs</p>
                          </div>
                          {pl.songs.length > 0 && (
                            <button
                              onClick={e => { e.stopPropagation(); handlePlayPlaylist(pl, 0, false) }}
                              className="opacity-0 group-hover:opacity-100 w-9 h-9 rounded-full bg-primary flex items-center justify-center flex-shrink-0 transition-opacity shadow-md"
                            >
                              <Play className="w-4 h-4 text-primary-foreground ml-0.5" fill="currentColor" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-20 text-muted-foreground">
                    <ListMusic className="w-12 h-12 opacity-20 mx-auto mb-3" />
                    <p className="font-medium">No playlists yet</p>
                    <p className="text-sm mt-1 opacity-60">Add songs to a playlist from the player</p>
                    <Button className="mt-4 rounded-full" onClick={() => setShowNewDlg(true)}>
                      <Plus className="w-4 h-4 mr-1.5" />Create Playlist
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── LIKED ── */}
          <TabsContent value="liked">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {likedSongs.length > 0
                ? likedSongs.map((song, idx) => <SongCard key={`liked-${song.id}-${idx}`} song={song} />)
                : <EmptyState icon={Heart} text="No liked songs yet" />
              }
            </div>
          </TabsContent>

          {/* ── DOWNLOADS ── */}
          <TabsContent value="downloads">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {downloadedSongs.length > 0
                ? downloadedSongs.map((song, idx) => <SongCard key={`dl-${song.id}-${idx}`} song={song as Song} />)
                : <EmptyState icon={Download} text="No downloaded songs yet" />
              }
            </div>
          </TabsContent>

          {/* ── Collab Playlists ── */}
          <TabsContent value="collab">
            <div className="space-y-4">
              {/* Create new collab */}
              <div className="rounded-2xl bg-card/40 border border-border/30 p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" /> Start a Collab Playlist
                </p>
                <p className="text-xs text-muted-foreground">Create a shared playlist that anyone with the link can add songs to.</p>
                <div className="flex gap-2">
                  <input
                    value={collabName}
                    onChange={e => setCollabName(e.target.value)}
                    placeholder="Playlist name…"
                    className="flex-1 h-10 px-3 rounded-xl bg-background/60 border border-border/40 text-sm focus:outline-none focus:border-primary/50"
                  />
                  <Button
                    onClick={async () => {
                      if (!collabName.trim()) return
                      setCollabLoading(true)
                      try {
                        const userId   = getGuestId()
                        const username = getPartyUsername()
                        const res  = await fetch("/api/collab", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ action: "create", name: collabName.trim(), ownerId: userId }),
                        })
                        const data = await res.json()
                        if (data.id) {
                          saveCollabRef({ id: data.id, name: collabName.trim(), joined: Date.now(), isOwner: true })
                          setCollabRefs(getCollabRefs())
                          setCollabName("")
                          router.push(`/collab/${data.id}`)
                        }
                      } catch {}
                      finally { setCollabLoading(false) }
                    }}
                    disabled={collabLoading || !collabName.trim()}
                    className="rounded-xl px-4 h-10"
                  >
                    {collabLoading ? <span className="animate-spin">⏳</span> : "Create"}
                  </Button>
                </div>
              </div>

              {/* Join via link */}
              <div className="rounded-2xl bg-card/40 border border-border/30 p-4 space-y-3">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-primary" /> Join a Collab Playlist
                </p>
                <div className="flex gap-2">
                  <input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    placeholder="Paste playlist ID or full link…"
                    className="flex-1 h-10 px-3 rounded-xl bg-background/60 border border-border/40 text-sm focus:outline-none focus:border-primary/50"
                  />
                  <Button
                    onClick={() => {
                      const raw = joinCode.trim()
                      const id  = raw.includes("/") ? raw.split("/").pop() : raw
                      if (id) { setJoinCode(""); router.push(`/collab/${id}`) }
                    }}
                    disabled={!joinCode.trim()}
                    variant="outline"
                    className="rounded-xl px-4 h-10"
                  >
                    Join
                  </Button>
                </div>
              </div>

              {/* My collab playlists */}
              {collabRefs.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recent Collab Playlists</p>
                  {collabRefs.map(ref => (
                    <div
                      key={ref.id}
                      className="group flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/40 border border-border/30 hover:border-primary/30 hover:bg-card/60 transition-all cursor-pointer"
                      onClick={() => router.push(`/collab/${ref.id}`)}
                    >
                      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{ref.name}</p>
                        <p className="text-xs text-muted-foreground">{ref.isOwner ? "Owner" : "Collaborator"}</p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            navigator.clipboard.writeText(`${window.location.origin}/collab/${ref.id}`)
                            setCopiedId(ref.id)
                            setTimeout(() => setCopiedId(null), 2000)
                          }}
                          className="p-1.5 rounded-lg hover:bg-primary/10 transition-colors"
                        >
                          {copiedId === ref.id ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                        </button>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            removeCollabRef(ref.id)
                            setCollabRefs(getCollabRefs())
                          }}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {collabRefs.length === 0 && (
                <div className="flex flex-col items-center py-12 text-center">
                  <Users className="w-10 h-10 text-muted-foreground/20 mb-3" />
                  <p className="text-sm text-muted-foreground">No collab playlists yet</p>
                  <p className="text-xs text-muted-foreground/60">Create one above or join with a link</p>
                </div>
              )}
            </div>
          </TabsContent>

        </Tabs>
      </div>

      {/* New playlist dialog */}
      <Dialog open={showNewDlg} onOpenChange={setShowNewDlg}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New Playlist</DialogTitle>
            <DialogDescription>Give your playlist a name</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="lib-pl-name">Name</Label>
            <Input
              id="lib-pl-name"
              placeholder="My Playlist"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleCreatePlaylist()}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowNewDlg(false)}>Cancel</Button>
            <Button onClick={handleCreatePlaylist}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
