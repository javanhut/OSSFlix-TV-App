import * as FileSystem from "expo-file-system/legacy";

jest.mock("../../src/api/client", () => ({
  api: {
    buildStreamUrl: jest.fn((src: string, audio: number) => `http://server/api/stream?src=${src}&audio=${audio}`),
    buildStreamHeaders: jest.fn(() => ({ Authorization: "Bearer test" })),
    buildSubtitleUrl: jest.fn((src: string) => `http://server/api/subtitles?src=${src}`),
    getProbe: jest.fn(async () => ({ duration: 42, audioTracks: [] })),
    getTimings: jest.fn(async () => ({
      video_src: "x",
      intro_start: null,
      intro_end: null,
      outro_start: 30,
      outro_end: 42,
    })),
    getCacheStatus: jest.fn(async () => ({
      cached: true,
      transcoding: false,
      bytesWritten: 100,
      duration: 42,
      fileSize: 100,
    })),
    prefetchStream: jest.fn(async () => ({
      prefetching: true,
      queued: true,
      cacheKey: "k",
    })),
  },
  resolveAssetUrl: jest.fn((path: string | null) => (path ? `http://server/${path}` : null)),
}));

import { api } from "../../src/api/client";
import {
  bootstrapDownloads,
  deleteDownload,
  downloadTuning,
  makeDownloadId,
  saveOfflineProgress,
  startDownload,
} from "../../src/downloads/downloadManager";
import { useDownloadsStore } from "../../src/state/downloads";

const mockApi = api as unknown as {
  getCacheStatus: jest.Mock;
  prefetchStream: jest.Mock;
};

function fsStore(): Map<string, string> {
  return (FileSystem as unknown as { __store: Map<string, string> }).__store;
}

async function flush(iterations = 30): Promise<void> {
  for (let i = 0; i < iterations; i++) {
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeEach(() => {
  useDownloadsStore.setState({ bootstrapped: false, items: {}, progress: {} });
  fsStore().clear();
  // Default: server already has a byte-exact file ready — no warm-up needed.
  mockApi.getCacheStatus.mockReset().mockResolvedValue({
    cached: true,
    transcoding: false,
    bytesWritten: 100,
    duration: 42,
    fileSize: 100,
  });
  mockApi.prefetchStream.mockClear();
  downloadTuning.pollMs = 5;
});

describe("makeDownloadId", () => {
  it("is stable for the same src + audio", () => {
    expect(makeDownloadId("/media/a.mkv", 0)).toBe(makeDownloadId("/media/a.mkv", 0));
  });

  it("differs by src and by audio track", () => {
    expect(makeDownloadId("/media/a.mkv", 0)).not.toBe(makeDownloadId("/media/b.mkv", 0));
    expect(makeDownloadId("/media/a.mkv", 0)).not.toBe(makeDownloadId("/media/a.mkv", 1));
  });
});

describe("startDownload", () => {
  it("downloads a video to completion with captured metadata and side assets", async () => {
    const id = await startDownload({
      src: "/media/a.mkv",
      dirPath: "/media",
      title: "Demo",
      episodeLabel: "S1 E1",
      poster: "images/a.jpg",
      subtitles: [
        {
          label: "English",
          language: "en",
          src: "/media/a.en.vtt",
          format: "vtt",
        },
      ],
      profileId: 1,
    });
    await flush();

    const item = useDownloadsStore.getState().items[id];
    expect(item?.status).toBe("completed");
    expect(item?.progress).toBe(1);
    expect(item?.duration).toBe(42);
    expect(item?.timings?.outro_start).toBe(30);
    expect(item?.fileUri).toBe(`file:///documents/downloads/${id}.mp4`);
    expect(item?.posterUri).toBe(`file:///documents/downloads/${id}.jpg`);
    expect(item?.subtitles?.[0]?.uri).toBe(`file:///documents/downloads/${id}.en.vtt`);

    // The video file and manifest are persisted to the file system.
    expect(fsStore().has(`file:///documents/downloads/${id}.mp4`)).toBe(true);
    expect(fsStore().has("file:///documents/downloads/manifest.json")).toBe(true);
  });

  it("downloads directly (no prefetch) when the server already has a cached file", async () => {
    await startDownload({
      src: "/media/websafe.mp4",
      dirPath: "/media",
      title: "Demo",
      profileId: 1,
    });
    await flush();
    expect(mockApi.prefetchStream).not.toHaveBeenCalled();
  });

  it("warms the server cache before downloading when nothing is cached yet", async () => {
    // First status check reports not-ready; after prefetch it becomes cached.
    let checks = 0;
    mockApi.getCacheStatus.mockImplementation(async () => {
      checks += 1;
      return checks >= 2
        ? {
            cached: true,
            transcoding: false,
            bytesWritten: 100,
            duration: 42,
            fileSize: 100,
          }
        : {
            cached: false,
            transcoding: true,
            bytesWritten: 10,
            duration: 0,
            fileSize: 0,
          };
    });

    const id = await startDownload({
      src: "/media/big.mkv",
      dirPath: "/media",
      title: "Big",
      profileId: 1,
    });
    for (let i = 0; i < 12 && useDownloadsStore.getState().items[id]?.status !== "completed"; i++) {
      await sleep(10);
      await flush(10);
    }

    expect(mockApi.prefetchStream).toHaveBeenCalledWith("/media/big.mkv", 0);
    expect(useDownloadsStore.getState().items[id]?.status).toBe("completed");
    expect(useDownloadsStore.getState().items[id]?.fileUri).toBe(`file:///documents/downloads/${id}.mp4`);
  });

  it("is a no-op when the item is already completed", async () => {
    const id = await startDownload({
      src: "/media/a.mkv",
      dirPath: "/media",
      title: "Demo",
      profileId: 1,
    });
    await flush();
    const createdAt = useDownloadsStore.getState().items[id]?.createdAt;
    await startDownload({
      src: "/media/a.mkv",
      dirPath: "/media",
      title: "Demo",
      profileId: 1,
    });
    await flush();
    expect(useDownloadsStore.getState().items[id]?.createdAt).toBe(createdAt);
  });
});

describe("deleteDownload", () => {
  it("removes the record, its files, and any offline progress", async () => {
    const id = await startDownload({
      src: "/media/a.mkv",
      dirPath: "/media",
      title: "Demo",
      profileId: 1,
    });
    await flush();
    await saveOfflineProgress(id, {
      current_time: 10,
      duration: 42,
      updatedAt: 1,
    });

    await deleteDownload(id);

    expect(useDownloadsStore.getState().items[id]).toBeUndefined();
    expect(useDownloadsStore.getState().progress[id]).toBeUndefined();
    expect(fsStore().has(`file:///documents/downloads/${id}.mp4`)).toBe(false);
  });
});

describe("bootstrapDownloads", () => {
  it("demotes interrupted downloads to paused on load", async () => {
    const id = await startDownload({
      src: "/media/a.mkv",
      dirPath: "/media",
      title: "Demo",
      profileId: 1,
    });
    await flush();
    // Simulate an app kill mid-download by rewriting the manifest.
    const raw = fsStore().get("file:///documents/downloads/manifest.json") as string;
    const parsed = JSON.parse(raw);
    parsed.items[id].status = "downloading";
    fsStore().set("file:///documents/downloads/manifest.json", JSON.stringify(parsed));

    await bootstrapDownloads();
    expect(useDownloadsStore.getState().items[id]?.status).toBe("paused");
  });
});
