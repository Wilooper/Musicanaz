export interface Song {
  id: string
  title: string
  artist: string
  thumbnail: string
  type: "musiva" | "jiosaavn" | "youtube" | "gaana-trending"
  videoId?: string
  artists?: string[]
  album?: string
  duration?: string
  isPodcast?: boolean        // set true for podcast episodes
  podcastId?: string         // browseId of the parent podcast (for related episodes)
  podcastTitle?: string      // name of the parent podcast show
}

export interface MusivaTrack {
  title: string
  videoId: string
  artists: Array<string | { name: string; id?: string }>
  album: string
  duration: string
  thumbnails: Array<{ url: string; width?: number; height?: number } | string>
  thumbnail?: string   // best URL, pre-computed by backend
  isExplicit?: boolean
  year?: string
}

export interface LyricLine {
  id: string
  start_time: number
  end_time: number
  text: string
}

export interface LyricsResponse {
  status: string
  data: {
    title: string
    artist: string
    album: string
    duration: number
    hasTimestamps: boolean
    instrumental: boolean
    timed_lyrics: LyricLine[]
    source: string
  }
}

export interface UpNextQueue {
  origin_video_id: string
  tracks: MusivaTrack[]
  count: number
  created_at: number
}

export interface ChartsResponse {
  songs:    MusivaTrack[]
  videos:   MusivaTrack[]
  artists:  any[]
  trending: MusivaTrack[]
}

export interface MoodCategory {
  title: string
  params: string
  section?: string
  thumbnail: string
  thumbnails: Array<{ url: string; width?: number }>
}

export interface MoodPlaylist {
  browseId: string
  title: string
  subtitle?: string
  thumbnail: string
  thumbnails: Array<{ url: string; width?: number }>
}

export interface GaanaTrendingSong {
  seokey: string
  album_seokey: string
  track_id: string
  title: string
  artists: string
  artist_seokeys: string
  artist_ids: string
  artist_image: string
  album: string
  album_id: string
  duration: string
  popularity: string
  genres: string
  is_explicit: boolean
  language: string
  label: string
  release_date: string
  play_count: string
  favorite_count: number
  song_url: string
  album_url: string
  images: { urls: { large_artwork: string; medium_artwork: string; small_artwork: string } }
  stream_urls: { urls: { very_high_quality: string; high_quality: string; medium_quality: string; low_quality: string } }
}
