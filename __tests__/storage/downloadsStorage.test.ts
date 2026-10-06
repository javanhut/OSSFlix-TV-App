import * as FileSystem from "expo-file-system/legacy";

import { loadManifest, posterUri, saveManifest, subtitleUri, videoUri } from "../../src/storage/downloadsStorage";
import type { DownloadsSnapshot } from "../../src/types/downloads";

beforeEach(() => {
  // Reset the in-memory FS between tests.
  (FileSystem as unknown as { __store: Map<string, string> }).__store.clear();
});

describe("downloadsStorage", () => {
  it("builds stable per-id file paths under the downloads dir", () => {
    expect(videoUri("abc")).toBe("file:///documents/downloads/abc.mp4");
    expect(posterUri("abc")).toBe("file:///documents/downloads/abc.jpg");
    expect(subtitleUri("abc", "en-US")).toBe("file:///documents/downloads/abc.enus.vtt");
  });

  it("returns an empty snapshot when no manifest exists", async () => {
    const snapshot = await loadManifest();
    expect(snapshot).toEqual({ items: {}, progress: {} });
  });

  it("round-trips a manifest through save and load", async () => {
    const snapshot: DownloadsSnapshot = {
      items: {
        a: {
          id: "a",
          src: "/media/a.mkv",
          audioIndex: 0,
          dirPath: "/media",
          title: "Demo",
          profileId: 2,
          status: "completed",
          progress: 1,
          fileUri: "file:///documents/downloads/a.mp4",
          createdAt: 1,
        },
      },
      progress: { a: { current_time: 12, duration: 60, updatedAt: 3 } },
    };
    await saveManifest(snapshot);
    const loaded = await loadManifest();
    expect(loaded).toEqual(snapshot);
  });
});
