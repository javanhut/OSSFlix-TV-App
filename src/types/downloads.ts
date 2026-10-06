import type { EpisodeTiming } from "./api";

export type DownloadStatus = "queued" | "downloading" | "paused" | "completed" | "failed";

export interface OfflineSubtitle {
  label: string;
  language: string;
  uri: string;
}

export interface DownloadItem {
  /** Stable identifier derived from `src` + `audioIndex`. */
  id: string;
  /** Original server-side video src (the same value passed to /api/stream). */
  src: string;
  audioIndex: number;
  /** Title directory this video belongs to (used to group downloads). */
  dirPath: string;
  /** Human-facing show/movie name. */
  title: string;
  /** Episode label such as "S1 E3" when known. */
  episodeLabel?: string;
  /** Profile that queued the download, so we can scope the Downloads screen. */
  profileId: number | null;
  status: DownloadStatus;
  /** 0..1 progress, or -1 when the total size is unknown (live transcode). */
  progress: number;
  /** Local file:// URI of the downloaded video (present once completed). */
  fileUri?: string;
  /** Local file:// URI of the poster image, when downloaded. */
  posterUri?: string | null;
  /** Duration in seconds captured from the probe endpoint at download time. */
  duration?: number;
  /** Intro/outro timings captured at download time, for offline skip. */
  timings?: EpisodeTiming | null;
  /** Locally stored subtitle tracks. */
  subtitles?: OfflineSubtitle[];
  bytesTotal?: number;
  /** Opaque resume token from expo-file-system for pause/resume. */
  resumeData?: string;
  createdAt: number;
}

export interface OfflineProgress {
  current_time: number;
  duration: number;
  updatedAt: number;
}

export interface DownloadsSnapshot {
  items: Record<string, DownloadItem>;
  progress: Record<string, OfflineProgress>;
}
