export function formatTitleType(type: string | undefined | null): string {
  if (!type) return "";
  const lower = type.trim().toLowerCase();
  if (lower === "tv show" || lower === "tv-show" || lower === "tvshow") return "TV Show";
  if (lower === "movie") return "Movie";
  return type.trim().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}
