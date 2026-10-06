import * as FileSystem from "expo-file-system/legacy";

import type { DownloadsSnapshot } from "../types/downloads";

const EMPTY_SNAPSHOT: DownloadsSnapshot = { items: {}, progress: {} };

/**
 * Root directory for all offline media. Uses documentDirectory (persistent),
 * not cacheDirectory, so downloads survive OS cache eviction.
 */
export function downloadsDir(): string {
  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new Error("File system document directory is unavailable.");
  }
  return `${base}downloads/`;
}

export function videoUri(id: string): string {
  return `${downloadsDir()}${id}.mp4`;
}

export function subtitleUri(id: string, language: string): string {
  const lang = language.replace(/[^a-z0-9]/gi, "").toLowerCase() || "sub";
  return `${downloadsDir()}${id}.${lang}.vtt`;
}

export function posterUri(id: string): string {
  return `${downloadsDir()}${id}.jpg`;
}

function manifestUri(): string {
  return `${downloadsDir()}manifest.json`;
}

export async function ensureDir(): Promise<void> {
  const dir = downloadsDir();
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
}

export async function loadManifest(): Promise<DownloadsSnapshot> {
  try {
    const info = await FileSystem.getInfoAsync(manifestUri());
    if (!info.exists) return EMPTY_SNAPSHOT;
    const raw = await FileSystem.readAsStringAsync(manifestUri());
    const parsed = JSON.parse(raw) as Partial<DownloadsSnapshot>;
    return {
      items: parsed.items ?? {},
      progress: parsed.progress ?? {},
    };
  } catch {
    return EMPTY_SNAPSHOT;
  }
}

export async function saveManifest(snapshot: DownloadsSnapshot): Promise<void> {
  await ensureDir();
  await FileSystem.writeAsStringAsync(manifestUri(), JSON.stringify(snapshot));
}

export async function deleteFileIfExists(uri?: string | null): Promise<void> {
  if (!uri) return;
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
}
