export interface PublicProfile {
  id: number;
  name: string;
  image_path: string | null;
  has_password: boolean;
}

export interface ProfileData {
  id: number;
  name: string;
  email: string | null;
  image_path: string | null;
  movies_directory: string | null;
  tvshows_directory: string | null;
  use_global_dirs: number;
}

export interface ServerInfo {
  name: string;
  version: string;
  mobileAuth: boolean;
}

export interface MobileAuthResponse {
  token: string;
  profile: ProfileData;
  expiresAt: string;
}

export interface TitleSummary {
  name: string;
  imagePath: string | null;
  pathToDir: string;
  type?: string;
  progressPct?: number;
}

export interface Recommendation extends TitleSummary {
  score: number;
  /** e.g. "Because you watch Action, Drama" */
  reason: string;
}

export interface CategoryRow {
  genre: string;
  titles: TitleSummary[];
}

export interface SubtitleTrack {
  label: string;
  language: string;
  src: string;
  format: string;
}

export interface SeasonMeta {
  season: number;
  description?: string;
  logo?: string;
}

export interface TitleDetails {
  name: string;
  description: string;
  genre: string[];
  type: string;
  cast?: string[];
  season?: number;
  episodes?: number;
  bannerImage: string | null;
  dirPath: string;
  videos: string[];
  subtitles?: SubtitleTrack[];
  seasonsMeta?: SeasonMeta[];
}

export interface PlaybackProgress {
  video_src: string;
  dir_path: string;
  current_time: number;
  duration: number;
  updated_at?: string;
}

export interface EpisodeTiming {
  video_src: string;
  intro_start: number | null;
  intro_end: number | null;
  outro_start: number | null;
  outro_end: number | null;
}

export interface AudioTrackInfo {
  index: number;
  codec: string;
  channels: number;
  channelLayout: string;
  language: string;
  title: string;
}

export interface StreamProbeResponse {
  duration: number;
  audioTracks: AudioTrackInfo[];
}

export interface CacheStatus {
  /** True when a complete, byte-exact file is ready to download from /api/stream. */
  cached: boolean;
  /** True while the server is still transcoding the file. */
  transcoding: boolean;
  bytesWritten: number;
  duration: number | string;
  fileSize: number;
  /** Present when the source is backed by KaidaDB. */
  kaidadb?: boolean;
}

export interface SearchResponse {
  titles: TitleSummary[];
  genres: string[];
}
