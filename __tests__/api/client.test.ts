import { api, normalizeServerUrl, resolveAssetUrl } from "../../src/api/client";
import { useSessionStore } from "../../src/state/session";

const SERVER = "http://media.local:9000";
const TOKEN = "tok-abc";

type FetchMock = jest.Mock<Promise<Response>, [RequestInfo, RequestInit?]>;

let fetchMock: FetchMock;

function jsonResponse(body: unknown, init: ResponseInit = { status: 200 }): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init.headers || {}) },
  });
}

beforeEach(() => {
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: SERVER,
    token: TOKEN,
    profile: null,
    selectedProfile: null,
  });
  fetchMock = jest.fn() as unknown as FetchMock;
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});

function expectCall(index: number, expected: { url?: string; method?: string; auth?: boolean; body?: unknown }) {
  const [calledUrl, init] = fetchMock.mock.calls[index];
  if (expected.url) expect(calledUrl).toBe(expected.url);
  const headers = new Headers(init?.headers);
  if (expected.auth === true) {
    expect(headers.get("Authorization")).toBe(`Bearer ${TOKEN}`);
  } else if (expected.auth === false) {
    expect(headers.get("Authorization")).toBeNull();
  }
  if (expected.method) expect((init?.method || "GET").toUpperCase()).toBe(expected.method.toUpperCase());
  if (expected.body !== undefined) {
    expect(init?.body).toBe(JSON.stringify(expected.body));
  }
}

describe("normalizeServerUrl", () => {
  it("prepends http:// when no protocol is given", () => {
    expect(normalizeServerUrl("example.com")).toBe("http://example.com");
  });

  it("preserves https://", () => {
    expect(normalizeServerUrl("https://media.local")).toBe("https://media.local");
  });

  it("preserves an explicit port", () => {
    expect(normalizeServerUrl("media.local:8080")).toBe("http://media.local:8080");
  });

  it("strips trailing slash, path, query, and hash", () => {
    expect(normalizeServerUrl("https://media.local:8443/some/path?x=1#frag")).toBe("https://media.local:8443");
  });

  it("trims surrounding whitespace", () => {
    expect(normalizeServerUrl("   media.local   ")).toBe("http://media.local");
  });

  it("throws on empty input", () => {
    expect(() => normalizeServerUrl("")).toThrow("Server URL is required.");
    expect(() => normalizeServerUrl("   ")).toThrow("Server URL is required.");
  });

  it("treats https:// as case-insensitive for the protocol check", () => {
    expect(normalizeServerUrl("HTTPS://media.local")).toBe("https://media.local");
  });
});

describe("resolveAssetUrl", () => {
  it("returns null for nullish input", () => {
    expect(resolveAssetUrl(null)).toBeNull();
    expect(resolveAssetUrl(undefined)).toBeNull();
    expect(resolveAssetUrl("")).toBeNull();
  });

  it("returns absolute URLs unchanged", () => {
    expect(resolveAssetUrl("https://cdn.example.com/poster.jpg")).toBe("https://cdn.example.com/poster.jpg");
    expect(resolveAssetUrl("http://other/poster.jpg")).toBe("http://other/poster.jpg");
  });

  it("joins relative paths against the configured server URL", () => {
    expect(resolveAssetUrl("/api/assets/poster.jpg")).toBe(`${SERVER}/api/assets/poster.jpg`);
    expect(resolveAssetUrl("api/assets/poster.jpg")).toBe(`${SERVER}/api/assets/poster.jpg`);
  });
});

describe("api.buildStreamHeaders / buildStreamUrl / buildSubtitleUrl", () => {
  it("returns empty object when no token is set", () => {
    useSessionStore.setState({ token: null });
    expect(api.buildStreamHeaders()).toEqual({});
  });

  it("returns Bearer auth header when a token is set", () => {
    expect(api.buildStreamHeaders()).toEqual({
      Authorization: `Bearer ${TOKEN}`,
    });
  });

  it("builds a stream URL with default audio index 0", () => {
    expect(api.buildStreamUrl("shows/foo.mkv")).toBe(`${SERVER}/api/stream?src=shows%2Ffoo.mkv&audio=0`);
  });

  it("honors a non-default audio index", () => {
    expect(api.buildStreamUrl("shows/foo.mkv", 2)).toBe(`${SERVER}/api/stream?src=shows%2Ffoo.mkv&audio=2`);
  });

  it("builds a subtitle URL", () => {
    expect(api.buildSubtitleUrl("shows/foo.en.vtt")).toBe(`${SERVER}/api/subtitles?src=shows%2Ffoo.en.vtt`);
  });
});

describe("error paths", () => {
  it("throws on non-OK responses with the server error message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "nope" }, { status: 400 }));
    await expect(api.getCategories()).rejects.toThrow("nope");
  });

  it("throws a fallback message when the server returns no error field", async () => {
    fetchMock.mockResolvedValueOnce(new Response("not json", { status: 500 }));
    await expect(api.getCategories()).rejects.toThrow("Request failed with status 500");
  });

  it("clears auth on 401 and propagates the error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: "unauthorized" }, { status: 401 }));
    await expect(api.getAuthenticatedProfile()).rejects.toThrow("unauthorized");
    expect(useSessionStore.getState().token).toBeNull();
  });

  it("throws when an authenticated request is made without a token", async () => {
    useSessionStore.setState({ token: null });
    await expect(api.getAuthenticatedProfile()).rejects.toThrow("Session expired.");
  });

  it("throws when the server URL is not configured", async () => {
    useSessionStore.setState({ serverUrl: null });
    await expect(api.getCategories()).rejects.toThrow("Server URL is not configured.");
  });
});

describe("api endpoints", () => {
  it("getServerInfo hits the server-info endpoint without auth", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ name: "srv", version: "1.0", mobileAuth: true }));
    const info = await api.getServerInfo("http://other.local");
    expect(info.mobileAuth).toBe(true);
    expectCall(0, { url: "http://other.local/api/mobile/server-info" });
  });

  it("lookupProfiles posts the email without auth", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ profiles: [], hasUnclaimed: false }));
    await api.lookupProfiles("a@b.c");
    expectCall(0, {
      url: `${SERVER}/api/auth/lookup`,
      method: "POST",
      auth: false,
      body: { email: "a@b.c" },
    });
  });

  it("lookupUnclaimed posts an empty body without auth", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ profiles: [] }));
    await api.lookupUnclaimed();
    expectCall(0, {
      url: `${SERVER}/api/auth/lookup-unclaimed`,
      method: "POST",
      auth: false,
      body: {},
    });
  });

  it("getGuestProfile GETs the guest endpoint without auth", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        profile: { id: 1, name: "Guest", image_path: null, has_password: true },
      }),
    );
    await api.getGuestProfile();
    expectCall(0, {
      url: `${SERVER}/api/auth/guest-profile`,
      method: "GET",
      auth: false,
    });
  });

  it("mobileLogin posts profileId + password without auth", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "t", profile: {}, expiresAt: "" }));
    await api.mobileLogin(1, "pw");
    expectCall(0, {
      url: `${SERVER}/api/mobile/auth/login`,
      method: "POST",
      auth: false,
      body: { profileId: 1, password: "pw" },
    });
  });

  it("mobileSetPassword posts to the set-password endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "t", profile: {}, expiresAt: "" }));
    await api.mobileSetPassword(2, "pw");
    expectCall(0, {
      url: `${SERVER}/api/mobile/auth/set-password`,
      method: "POST",
      auth: false,
      body: { profileId: 2, password: "pw" },
    });
  });

  it("mobileRegister posts the registration payload", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ token: "t", profile: {}, expiresAt: "" }));
    await api.mobileRegister("Ada", "a@b.c", "pw");
    expectCall(0, {
      url: `${SERVER}/api/mobile/auth/register`,
      method: "POST",
      auth: false,
      body: { name: "Ada", email: "a@b.c", password: "pw" },
    });
  });

  it("mobileLogout posts authenticated", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.mobileLogout();
    expectCall(0, {
      url: `${SERVER}/api/mobile/auth/logout`,
      method: "POST",
      auth: true,
      body: {},
    });
  });

  it("getAuthenticatedProfile sends bearer auth", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ profile: {} }));
    await api.getAuthenticatedProfile();
    expectCall(0, { url: `${SERVER}/api/mobile/auth/me`, auth: true });
  });

  it("getCategories is authenticated", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await api.getCategories();
    expectCall(0, { url: `${SERVER}/api/media/categories`, auth: true });
  });

  it("getContinueWatching is authenticated", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ genre: "continue", titles: [] }));
    await api.getContinueWatching();
    expectCall(0, {
      url: `${SERVER}/api/playback/continue-watching`,
      auth: true,
    });
  });

  it("getWatchlist is authenticated", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ genre: "watchlist", titles: [] }));
    await api.getWatchlist();
    expectCall(0, { url: `${SERVER}/api/watchlist`, auth: true });
  });

  it("getLibrary URL-encodes the type", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await api.getLibrary("tv show");
    expectCall(0, {
      url: `${SERVER}/api/media/titles?type=tv%20show`,
      auth: true,
    });
  });

  it("search URL-encodes the query", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ titles: [], genres: [] }));
    await api.search("foo bar");
    expectCall(0, {
      url: `${SERVER}/api/media/search?q=foo%20bar`,
      auth: true,
    });
  });

  it("getTitleDetails URL-encodes the dir path", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    await api.getTitleDetails("shows/Foo Bar");
    expectCall(0, {
      url: `${SERVER}/api/media/info?dir=shows%2FFoo%20Bar`,
      auth: true,
    });
  });

  it("getProgressForDir URL-encodes the dir", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse([]));
    await api.getProgressForDir("shows/Foo");
    expectCall(0, {
      url: `${SERVER}/api/playback/progress?dir=shows%2FFoo`,
      auth: true,
    });
  });

  it("getProgressForVideo URL-encodes the src", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(null));
    await api.getProgressForVideo("shows/Foo/ep1.mkv");
    expectCall(0, {
      url: `${SERVER}/api/playback/progress?src=shows%2FFoo%2Fep1.mkv`,
      auth: true,
    });
  });

  it("saveProgress PUTs with auth and JSON body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.saveProgress({
      video_src: "shows/Foo/ep1.mkv",
      dir_path: "shows/Foo",
      current_time: 12,
      duration: 3600,
    });
    expectCall(0, {
      url: `${SERVER}/api/playback/progress`,
      method: "PUT",
      auth: true,
      body: {
        video_src: "shows/Foo/ep1.mkv",
        dir_path: "shows/Foo",
        current_time: 12,
        duration: 3600,
      },
    });
  });

  it("watchlistCheck encodes the dir", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ inList: true }));
    await api.watchlistCheck("shows/Foo");
    expectCall(0, {
      url: `${SERVER}/api/watchlist/check?dir=shows%2FFoo`,
      auth: true,
    });
  });

  it("addToWatchlist POSTs the dir path", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.addToWatchlist("shows/Foo");
    expectCall(0, {
      url: `${SERVER}/api/watchlist`,
      method: "POST",
      auth: true,
      body: { dir_path: "shows/Foo" },
    });
  });

  it("removeFromWatchlist DELETEs the dir path", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
    await api.removeFromWatchlist("shows/Foo");
    expectCall(0, {
      url: `${SERVER}/api/watchlist`,
      method: "DELETE",
      auth: true,
      body: { dir_path: "shows/Foo" },
    });
  });

  it("getProbe encodes the src", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ duration: 0, audioTracks: [] }));
    await api.getProbe("shows/Foo/ep1.mkv");
    expectCall(0, {
      url: `${SERVER}/api/stream/probe?src=shows%2FFoo%2Fep1.mkv`,
      auth: true,
    });
  });

  it("getTimings encodes the src", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        video_src: "",
        intro_start: null,
        intro_end: null,
        outro_start: null,
        outro_end: null,
      }),
    );
    await api.getTimings("shows/Foo/ep1.mkv");
    expectCall(0, {
      url: `${SERVER}/api/episode/timings?src=shows%2FFoo%2Fep1.mkv`,
      auth: true,
    });
  });
});
