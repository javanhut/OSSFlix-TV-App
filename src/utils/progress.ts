export type ProgressLike = {
  current_time: number;
  duration: number;
};

// Credits usually fill the last few minutes, so past 90% (or the final seconds) counts as watched.
const WATCHED_FRACTION = 0.9;
const WATCHED_TAIL_SECONDS = 5;

export function isProgressWatched(progress: ProgressLike | null | undefined): boolean {
  if (!progress || !(progress.duration > 0)) return false;
  return (
    progress.current_time >= progress.duration - WATCHED_TAIL_SECONDS ||
    progress.current_time / progress.duration >= WATCHED_FRACTION
  );
}

export function isProgressInProgress(progress: ProgressLike | null | undefined): boolean {
  return !!progress && progress.current_time > 0 && !isProgressWatched(progress);
}
