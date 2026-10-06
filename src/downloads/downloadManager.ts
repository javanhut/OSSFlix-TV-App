import * as FileSystem from "expo-file-system/legacy";

import { api, resolveAssetUrl } from "../api/client";
import { buildDownloadsSnapshot, useDownloadsStore } from "../state/downloads";
import {
  deleteFileIfExists,
  ensureDir,
  loadManifest,
  posterUri,
  saveManifest,
  subtitleUri,
  videoUri,
} from "../storage/downloadsStorage";
import type { SubtitleTrack } from "../types/api";
import type { DownloadItem, OfflineProgress, OfflineSubtitle } from "../types/downloads";

const MAX_CONCURRENT = 2;

/**
 * Poll/timeout tuning for the server-side cache warm-up phase. Exposed so tests
 * can shorten the interval instead of waiting on real timers.
 */
export const downloadTuning = {
  pollMs: 2000,
  timeoutMs: 15 * 60 * 1000,
};

/** Live, non-serializable download handles, kept out of the store. */
const activeHandles = new Map<string, FileSystem.DownloadResumable>();
/** Ids currently being processed (cache warm-up or byte download), for the concurrency cap. */
const active = new Set<string>();
/** FIFO queue of download ids awaiting a free slot. */
const queue: string[] = [];

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Deterministic id from src + audio track (FNV-1a → hex). */
export function makeDownloadId(src: string, audioIndex: number): string {
  const input = `${src}::${audioIndex}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function persist(): Promise<void> {
  await saveManifest(buildDownloadsSnapshot()).catch(() => {});
}

export interface StartDownloadParams {
  src: string;
  audioIndex?: number;
  dirPath: string;
  title: string;
  episodeLabel?: string;
  poster?: string | null;
  subtitles?: SubtitleTrack[];
  profileId: number | null;
}

export async function startDownload(params: StartDownloadParams): Promise<string> {
  const audioIndex = params.audioIndex ?? 0;
  const id = makeDownloadId(params.src, audioIndex);
  const store = useDownloadsStore.getState();
  const existing = store.items[id];

  // Already downloaded or in-flight — no-op.
  if (
    existing &&
    (existing.status === "completed" || existing.status === "downloading" || existing.status === "queued")
  ) {
    return id;
  }

  const item: DownloadItem = {
    id,
    src: params.src,
    audioIndex,
    dirPath: params.dirPath,
    title: params.title,
    episodeLabel: params.episodeLabel,
    profileId: params.profileId,
    status: "queued",
    progress: 0,
    posterUri: existing?.posterUri ?? null,
    subtitles: existing?.subtitles,
    // Carry any subtitle/poster source info via closure below.
    createdAt: existing?.createdAt ?? Date.now(),
  };
  store.upsert(item);
  pendingSources.set(id, {
    poster: params.poster ?? null,
    subtitles: params.subtitles ?? [],
  });
  if (!queue.includes(id)) queue.push(id);
  await persist();
  void pump();
  return id;
}

/** Source metadata needed once a video download completes (not persisted). */
const pendingSources = new Map<string, { poster: string | null; subtitles: SubtitleTrack[] }>();

function pump(): void {
  while (active.size < MAX_CONCURRENT && queue.length > 0) {
    const id = queue.shift();
    if (!id) continue;
    const item = useDownloadsStore.getState().items[id];
    if (!item || item.status !== "queued") continue;
    active.add(id);
    void runDownload(id);
  }
}

/**
 * Ask the server to produce a complete, byte-exact file before we download it.
 *
 * KaidaDB is not reachable by the client, so the only media route is
 * /api/stream. For web-safe originals that endpoint pass-through-proxies the
 * KaidaDB object (Content-Length + Range → resumable). For non-web-safe
 * originals it live-transcodes with no Content-Length unless a full-file cache
 * already exists — so we warm that cache via /api/stream/prefetch and wait for
 * /api/stream/cache/status to report `cached`. Returns true once the server can
 * serve a real file (or on timeout, where we fall back to whatever it yields).
 */
async function ensureServerCache(id: string): Promise<boolean> {
  const item = useDownloadsStore.getState().items[id];
  if (!item) return false;

  const check = () => api.getCacheStatus(item.src, item.audioIndex).catch(() => null);
  let status = await check();
  if (status?.cached && !status.transcoding) return true;

  // Not ready — kick off a full-file transcode and poll until it completes.
  useDownloadsStore.getState().patch(id, { progress: -1 });
  await api.prefetchStream(item.src, item.audioIndex).catch(() => {});

  const deadline = Date.now() + downloadTuning.timeoutMs;
  while (Date.now() < deadline) {
    // Bail out if the user paused or removed the download while we waited.
    const current = useDownloadsStore.getState().items[id];
    if (!current || current.status !== "downloading") return false;
    await delay(downloadTuning.pollMs);
    status = await check();
    if (status?.cached && !status.transcoding) return true;
  }
  // Timed out — fall back to downloading whatever /api/stream serves.
  return true;
}

function makeProgressCallback(id: string) {
  return (progress: FileSystem.DownloadProgressData) => {
    const total = progress.totalBytesExpectedToWrite;
    const pct = total > 0 ? progress.totalBytesWritten / total : -1;
    useDownloadsStore.getState().patch(id, {
      progress: pct,
      bytesTotal: total > 0 ? total : undefined,
    });
  };
}

async function runDownload(id: string): Promise<void> {
  try {
    const item = useDownloadsStore.getState().items[id];
    if (!item) return;
    useDownloadsStore.getState().patch(id, { status: "downloading" });

    // 1. Make sure the server has a complete file to hand us.
    const ready = await ensureServerCache(id);
    if (!ready) return; // paused/removed mid-wait — state already reflects it.
    if (useDownloadsStore.getState().items[id]?.status !== "downloading") return;

    // 2. Download the (now cached / web-safe passthrough) file.
    await ensureDir().catch(() => {});
    const target = videoUri(id);
    const resumable = FileSystem.createDownloadResumable(
      api.buildStreamUrl(item.src, item.audioIndex),
      target,
      { headers: api.buildStreamHeaders() },
      makeProgressCallback(id),
    );
    activeHandles.set(id, resumable);
    const result = await resumable.downloadAsync();
    activeHandles.delete(id);
    if (!result) return; // undefined result means the task was paused.
    await finalizeDownload(id, target);
  } catch {
    activeHandles.delete(id);
    useDownloadsStore.getState().patch(id, { status: "failed" });
    await persist();
  } finally {
    active.delete(id);
    pump();
  }
}

async function finalizeDownload(id: string, fileUri: string): Promise<void> {
  const store = useDownloadsStore.getState();
  const item = store.items[id];
  if (!item) return;
  const sources = pendingSources.get(id);

  // Best-effort metadata + side assets while we are still online.
  const [probe, timings] = await Promise.all([
    api.getProbe(item.src).catch(() => null),
    api.getTimings(item.src).catch(() => null),
  ]);

  let posterLocal: string | null = item.posterUri ?? null;
  const posterUrl = resolveAssetUrl(sources?.poster ?? null);
  if (posterUrl) {
    try {
      await FileSystem.downloadAsync(posterUrl, posterUri(id));
      posterLocal = posterUri(id);
    } catch {
      posterLocal = item.posterUri ?? null;
    }
  }

  const offlineSubtitles: OfflineSubtitle[] = [];
  for (const track of sources?.subtitles ?? []) {
    try {
      const dest = subtitleUri(id, track.language);
      await FileSystem.downloadAsync(api.buildSubtitleUrl(track.src), dest, {
        headers: api.buildStreamHeaders(),
      });
      offlineSubtitles.push({
        label: track.label,
        language: track.language,
        uri: dest,
      });
    } catch {
      // Skip subtitle tracks that fail to download.
    }
  }

  pendingSources.delete(id);
  useDownloadsStore.getState().patch(id, {
    status: "completed",
    progress: 1,
    fileUri,
    posterUri: posterLocal,
    duration: probe?.duration,
    timings,
    subtitles: offlineSubtitles.length ? offlineSubtitles : item.subtitles,
  });
  await persist();
}

export async function pauseDownload(id: string): Promise<void> {
  const handle = activeHandles.get(id);
  if (!handle) return;
  try {
    const state = await handle.pauseAsync();
    activeHandles.delete(id);
    useDownloadsStore.getState().patch(id, { status: "paused", resumeData: state.resumeData });
    await persist();
  } catch {
    // Ignore pause failures; leave state as-is.
  }
  pump();
}

export async function resumeDownload(id: string): Promise<void> {
  const item = useDownloadsStore.getState().items[id];
  if (!item || item.status === "downloading" || item.status === "completed") return;

  // No resume token (killed mid-flight or failed) — re-run the full gated flow
  // so the server cache is re-checked before we download.
  if (!item.resumeData) {
    useDownloadsStore.getState().patch(id, { status: "queued", progress: 0 });
    if (!queue.includes(id)) queue.push(id);
    pump();
    return;
  }

  // Resume the partially-downloaded byte stream from where it stopped.
  active.add(id);
  useDownloadsStore.getState().patch(id, { status: "downloading" });
  const target = videoUri(id);
  const resumable = FileSystem.createDownloadResumable(
    api.buildStreamUrl(item.src, item.audioIndex),
    target,
    { headers: api.buildStreamHeaders() },
    makeProgressCallback(id),
    item.resumeData,
  );
  activeHandles.set(id, resumable);
  try {
    const result = await resumable.resumeAsync();
    activeHandles.delete(id);
    if (!result) return;
    await finalizeDownload(id, target);
  } catch {
    activeHandles.delete(id);
    useDownloadsStore.getState().patch(id, { status: "failed" });
    await persist();
  } finally {
    active.delete(id);
    pump();
  }
}

export async function deleteDownload(id: string): Promise<void> {
  const item = useDownloadsStore.getState().items[id];
  const handle = activeHandles.get(id);
  if (handle) {
    await handle.pauseAsync().catch(() => {});
    activeHandles.delete(id);
  }
  const queueIndex = queue.indexOf(id);
  if (queueIndex >= 0) queue.splice(queueIndex, 1);
  active.delete(id);
  pendingSources.delete(id);

  if (item) {
    await deleteFileIfExists(item.fileUri ?? videoUri(id));
    await deleteFileIfExists(item.posterUri);
    for (const sub of item.subtitles ?? []) {
      await deleteFileIfExists(sub.uri);
    }
  } else {
    await deleteFileIfExists(videoUri(id));
  }

  const store = useDownloadsStore.getState();
  store.remove(id);
  const progress = { ...store.progress };
  delete progress[id];
  useDownloadsStore.setState({ progress });
  await persist();
  pump();
}

/** Persist offline playback position (called by the player while offline). */
export async function saveOfflineProgress(id: string, progress: OfflineProgress): Promise<void> {
  useDownloadsStore.getState().setProgress(id, progress);
  await persist();
}

/** Load the manifest into the store and normalize interrupted downloads. */
export async function bootstrapDownloads(): Promise<void> {
  const snapshot = await loadManifest();
  // Any download that was mid-flight when the app was killed cannot resume its
  // handle, so surface it as paused for the user to retry.
  for (const item of Object.values(snapshot.items)) {
    if (item.status === "downloading" || item.status === "queued") {
      item.status = "paused";
    }
  }
  useDownloadsStore.getState().hydrate(snapshot);
}
