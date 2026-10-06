export type AudioVariant = "sub" | "dub";

export interface ParsedEpisode {
  season: number;
  episode: number;
  title: string;
  ext: string;
}

export const SEASON_TOKEN = /^(?:s|season\s?)0*(\d+)$/i;
export const EPISODE_TOKEN = /^(?:e|ep|episode\s?)0*(\d+)$/i;
export const COMBINED_SE_TOKEN = /(?:^|[._\s-])(?:s|season\s?)0*(\d+)[._\s-]*(?:e|ep|episode\s?)0*(\d+)(?=$|[._\s-])/i;
export const CANONICAL_SUFFIX = /_s(\d+)_ep(\d+)(?:_(?:sub|dub))?\.[^.]+$/i;
export const VARIANT_SUFFIX = /_(sub|dub)\.[^.]+$/i;

export function detectVariant(videoSrc: string): AudioVariant | null {
  const filename = videoSrc.split("/").pop() || videoSrc;
  const match = filename.match(VARIANT_SUFFIX);
  return match ? (match[1].toLowerCase() as AudioVariant) : null;
}

export function inferEpisodeVariants(videos: string[]): Map<string, AudioVariant | null> {
  const result = new Map<string, AudioVariant | null>();
  const byEpisode = new Map<string, string[]>();

  for (const src of videos) {
    result.set(src, detectVariant(src));
    const filename = src.split("/").pop() || src;
    const parsed = parseEpisodePath(filename);
    if (!parsed) continue;
    const key = `s${parsed.season}e${parsed.episode}`;
    const list = byEpisode.get(key);
    if (list) list.push(src);
    else byEpisode.set(key, [src]);
  }

  for (const group of byEpisode.values()) {
    if (group.length < 2) continue;
    const tagged = new Set<AudioVariant>();
    const untagged: string[] = [];
    for (const src of group) {
      const v = result.get(src) ?? null;
      if (v) tagged.add(v);
      else untagged.push(src);
    }
    if (untagged.length === 0) continue;
    let inferred: AudioVariant | null = null;
    if (tagged.has("sub") && !tagged.has("dub")) inferred = "dub";
    else if (tagged.has("dub") && !tagged.has("sub")) inferred = "sub";
    if (!inferred) continue;
    for (const src of untagged) result.set(src, inferred);
  }

  return result;
}

export function titleFromStem(stem: string): string {
  const cleaned = stem.replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned.replace(/\b([a-z])/g, (m) => m.toUpperCase());
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function slugTitle(title: string): string {
  return title
    .trim()
    .replace(/[/\\:*?"<>|]/g, "")
    .replace(/\s+/g, "_")
    .toLowerCase();
}

export function canonicalFilename(p: ParsedEpisode): string {
  const slug = slugTitle(p.title) || "episode";
  return `${slug}_s${pad2(p.season)}_ep${pad2(p.episode)}.${p.ext}`;
}

export function formatEpisodeLabel(p: ParsedEpisode): string {
  const base = `S${p.season} E${p.episode}`;
  return p.title ? `${base} - ${p.title}` : base;
}

/**
 * Parse any of these layouts (relative path inside the title directory):
 *   A: "s1/ep1/pilot.mkv"                 → S1 E1 - Pilot
 *   B: "s1/MyShow_s1_ep02.mkv"            → S1 E2 - MyShow
 *   C: "s01/ep02/The Bank Job.mkv"        → S1 E2 - The Bank Job
 *   Legacy flat: "MyShow_s01_ep02.mkv"    → S1 E2 - MyShow
 * Returns null if season+episode cannot be determined.
 */
export function parseEpisodePath(relPath: string): ParsedEpisode | null {
  const segments = relPath.split("/").filter((s) => s.length > 0);
  if (segments.length === 0) return null;
  const filename = segments.pop()!;
  const dotIdx = filename.lastIndexOf(".");
  const ext = dotIdx >= 0 ? filename.slice(dotIdx + 1).toLowerCase() : "";
  const stem = dotIdx >= 0 ? filename.slice(0, dotIdx) : filename;

  let seasonFromDir: number | null = null;
  let epFromDir: number | null = null;
  for (const seg of segments) {
    const trimmed = seg.trim();
    const sMatch = trimmed.match(SEASON_TOKEN);
    if (sMatch) {
      seasonFromDir = Number(sMatch[1]);
      continue;
    }
    const eMatch = trimmed.match(EPISODE_TOKEN);
    if (eMatch) {
      epFromDir = Number(eMatch[1]);
    }
  }

  let seasonFromFile: number | null = null;
  let epFromFile: number | null = null;
  let titleRemnant = stem;
  const combined = stem.match(COMBINED_SE_TOKEN);
  if (combined) {
    seasonFromFile = Number(combined[1]);
    epFromFile = Number(combined[2]);
    const stripAllSE = /(?:^|[._\s-])(?:s|season\s?)0*\d+[._\s-]*(?:e|ep|episode\s?)0*\d+(?=$|[._\s-])/gi;
    titleRemnant = stem
      .replace(stripAllSE, " ")
      .replace(/_(sub|dub)\b/gi, " ")
      .replace(/[._\s-]+/g, " ")
      .trim();
  }

  const season = seasonFromDir ?? seasonFromFile;
  const episode = epFromDir ?? epFromFile;
  if (season == null || episode == null) return null;

  let title: string;
  if (combined) {
    title = titleFromStem(titleRemnant);
  } else {
    title = titleFromStem(stem);
  }

  return { season, episode, title, ext };
}

export function compareVideoSrc(a: string, b: string): number {
  const pa = parseEpisodePath(a);
  const pb = parseEpisodePath(b);
  if (pa && pb) {
    if (pa.season !== pb.season) return pa.season - pb.season;
    if (pa.episode !== pb.episode) return pa.episode - pb.episode;
  } else if (pa) {
    return -1;
  } else if (pb) {
    return 1;
  }
  return a.localeCompare(b, undefined, { numeric: true });
}
