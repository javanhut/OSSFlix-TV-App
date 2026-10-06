import type {
  CacheStatus,
  CategoryRow,
  MobileAuthResponse,
  PlaybackProgress,
  ProfileData,
  PublicProfile,
  Recommendation,
  SearchResponse,
  ServerInfo,
  StreamProbeResponse,
  TitleDetails,
  TitleSummary,
} from "../types/api";
import { useSessionStore } from "../state/session";

function getServerUrl(): string {
  const serverUrl = useSessionStore.getState().serverUrl;
  if (!serverUrl) {
    throw new Error("Server URL is not configured.");
  }
  return serverUrl;
}

export function normalizeServerUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("Server URL is required.");
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const url = new URL(withProtocol);
  url.pathname = "";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

function buildUrl(path: string): string {
  return new URL(path, `${getServerUrl()}/`).toString();
}

function buildHeaders(authenticated = true, extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (authenticated) {
    const token = useSessionStore.getState().token;
    if (!token) {
      throw new Error("Session expired.");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }
  return headers;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));
  const error = payload && typeof payload === "object" ? (payload as { error?: string }).error : undefined;
  if (!response.ok || error) {
    const message = error || `Request failed with status ${response.status}`;
    if (response.status === 401 && useSessionStore.getState().token) {
      useSessionStore.getState().clearAuth();
    }
    throw new Error(message);
  }
  return payload as T;
}

async function requestJson<T>(path: string, init?: RequestInit, authenticated = true): Promise<T> {
  const response = await fetch(buildUrl(path), {
    ...init,
    headers: buildHeaders(authenticated, init?.headers),
  });
  return parseResponse<T>(response);
}

async function postJson<T>(path: string, body: unknown, authenticated = true): Promise<T> {
  return requestJson<T>(
    path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    authenticated,
  );
}

export function resolveAssetUrl(path?: string | null): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return buildUrl(path.startsWith("/") ? path.slice(1) : path);
}

export const api = {
  async getServerInfo(serverUrl: string): Promise<ServerInfo> {
    const normalized = normalizeServerUrl(serverUrl);
    const response = await fetch(new URL("/api/mobile/server-info", `${normalized}/`).toString());
    return parseResponse<ServerInfo>(response);
  },

  lookupProfiles(email: string) {
    return postJson<{ profiles: PublicProfile[]; hasUnclaimed: boolean }>("/api/auth/lookup", { email }, false);
  },

  lookupUnclaimed() {
    return postJson<{ profiles: PublicProfile[] }>("/api/auth/lookup-unclaimed", {}, false);
  },

  getGuestProfile() {
    return requestJson<{ profile: PublicProfile }>("/api/auth/guest-profile", undefined, false);
  },

  mobileLogin(profileId: number, password: string) {
    return postJson<MobileAuthResponse>("/api/mobile/auth/login", { profileId, password }, false);
  },

  mobileSetPassword(profileId: number, password: string) {
    return postJson<MobileAuthResponse>("/api/mobile/auth/set-password", { profileId, password }, false);
  },

  mobileRegister(name: string, email: string, password: string) {
    return postJson<MobileAuthResponse>("/api/mobile/auth/register", { name, email, password }, false);
  },

  mobileLogout() {
    return postJson<{ ok: boolean }>("/api/mobile/auth/logout", {});
  },

  getAuthenticatedProfile() {
    return requestJson<{ profile: ProfileData }>("/api/mobile/auth/me");
  },

  getCategories() {
    return requestJson<CategoryRow[]>("/api/media/categories");
  },

  getRecommendations(limit = 5) {
    return requestJson<Recommendation[]>(`/api/recommendations?limit=${limit}`);
  },

  getContinueWatching() {
    return requestJson<CategoryRow>("/api/playback/continue-watching");
  },

  getWatchlist() {
    return requestJson<CategoryRow>("/api/watchlist");
  },

  getLibrary(type: string) {
    return requestJson<TitleSummary[]>(`/api/media/titles?type=${encodeURIComponent(type)}`);
  },

  search(query: string) {
    return requestJson<SearchResponse>(`/api/media/search?q=${encodeURIComponent(query)}`);
  },

  getTitleDetails(dirPath: string) {
    return requestJson<TitleDetails>(`/api/media/info?dir=${encodeURIComponent(dirPath)}`);
  },

  getProgressForDir(dirPath: string) {
    return requestJson<PlaybackProgress[]>(`/api/playback/progress?dir=${encodeURIComponent(dirPath)}`);
  },

  getProgressForVideo(src: string) {
    return requestJson<PlaybackProgress | null>(`/api/playback/progress?src=${encodeURIComponent(src)}`);
  },

  saveProgress(body: { video_src: string; dir_path: string; current_time: number; duration: number }) {
    return requestJson<{ ok: boolean }>("/api/playback/progress", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  },

  watchlistCheck(dirPath: string) {
    return requestJson<{ inList: boolean }>(`/api/watchlist/check?dir=${encodeURIComponent(dirPath)}`);
  },

  addToWatchlist(dirPath: string) {
    return requestJson<{ ok: boolean }>("/api/watchlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dir_path: dirPath }),
    });
  },

  removeFromWatchlist(dirPath: string) {
    return requestJson<{ ok: boolean }>("/api/watchlist", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ dir_path: dirPath }),
    });
  },

  getProbe(src: string) {
    return requestJson<StreamProbeResponse>(`/api/stream/probe?src=${encodeURIComponent(src)}`);
  },

  // Asks the server to transcode/materialize a complete, byte-exact file so a
  // subsequent /api/stream download gets a real Content-Length + Range support
  // (instead of a chunked live transcode).
  prefetchStream(src: string, audioIndex = 0) {
    return requestJson<{
      prefetching: boolean;
      queued: boolean;
      cacheKey: string;
    }>(`/api/stream/prefetch?src=${encodeURIComponent(src)}&audio=${audioIndex}`);
  },

  getCacheStatus(src: string, audioIndex = 0) {
    return requestJson<CacheStatus>(`/api/stream/cache/status?src=${encodeURIComponent(src)}&audio=${audioIndex}`);
  },

  getTimings(src: string) {
    return requestJson<{
      video_src: string;
      intro_start: number | null;
      intro_end: number | null;
      outro_start: number | null;
      outro_end: number | null;
    }>(`/api/episode/timings?src=${encodeURIComponent(src)}`);
  },

  buildStreamUrl(src: string, audioIndex = 0) {
    return buildUrl(`/api/stream?src=${encodeURIComponent(src)}&audio=${audioIndex}`);
  },

  buildSubtitleUrl(src: string) {
    return buildUrl(`/api/subtitles?src=${encodeURIComponent(src)}`);
  },

  buildStreamHeaders(): Record<string, string> {
    const token = useSessionStore.getState().token;
    if (!token) {
      return {};
    }
    return {
      Authorization: `Bearer ${token}`,
    };
  },
};
