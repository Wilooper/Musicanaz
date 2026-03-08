export interface TopSongSubmission {
  songId: string
  title: string
  artist: string
  artistId?: string
  albumArt?: string
  duration?: number
  genre?: string
  playCount: number
}

export interface TopArtistSubmission {
  artistId: string
  name: string
  imageUrl?: string
  genres?: string[]
  listenCount: number
}

export interface TrendingSong {
  songId: string
  title: string
  artist: string
  artistId?: string
  albumArt?: string
  duration?: number
  genre?: string
  totalPlayCount: number
  userCount: number
  trendingScore: number
  lastUpdated: string
}

export interface TrendingArtist {
  artistId: string
  name: string
  imageUrl?: string
  genres: string[]
  favoriteCount: number
  trendingScore: number
  lastUpdated: string
}

export interface TrendingSongsResponse {
  total: number
  page: number
  limit: number
  totalPages: number
  songs: TrendingSong[]
}

export interface TrendingArtistsResponse {
  total: number
  page: number
  limit: number
  totalPages: number
  artists: TrendingArtist[]
}

export interface ToplayStatus {
  status: string
  pendingUsers: number
  groupSize: number
  timestamp: string
}
