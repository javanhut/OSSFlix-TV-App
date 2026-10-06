import { buildDownloadsSnapshot, useDownloadsStore } from "../../src/state/downloads";
import type { DownloadItem } from "../../src/types/downloads";

const FRESH = { bootstrapped: false, items: {}, progress: {} };

function makeItem(id: string, overrides: Partial<DownloadItem> = {}): DownloadItem {
  return {
    id,
    src: `/media/${id}.mkv`,
    audioIndex: 0,
    dirPath: "/media",
    title: "Demo",
    profileId: 1,
    status: "queued",
    progress: 0,
    createdAt: 123,
    ...overrides,
  };
}

beforeEach(() => {
  useDownloadsStore.setState(FRESH);
});

describe("useDownloadsStore", () => {
  it("hydrates items and progress from a snapshot", () => {
    useDownloadsStore.getState().hydrate({
      items: { a: makeItem("a") },
      progress: { a: { current_time: 5, duration: 10, updatedAt: 1 } },
    });
    const state = useDownloadsStore.getState();
    expect(state.bootstrapped).toBe(true);
    expect(state.items.a?.id).toBe("a");
    expect(state.progress.a?.current_time).toBe(5);
  });

  it("upsert adds and patch merges without dropping fields", () => {
    useDownloadsStore.getState().upsert(makeItem("a", { status: "downloading" }));
    useDownloadsStore.getState().patch("a", { progress: 0.5 });
    const item = useDownloadsStore.getState().items.a;
    expect(item?.status).toBe("downloading");
    expect(item?.progress).toBe(0.5);
  });

  it("patch is a no-op for unknown ids", () => {
    useDownloadsStore.getState().patch("missing", { progress: 1 });
    expect(useDownloadsStore.getState().items.missing).toBeUndefined();
  });

  it("remove deletes the item", () => {
    useDownloadsStore.getState().upsert(makeItem("a"));
    useDownloadsStore.getState().remove("a");
    expect(useDownloadsStore.getState().items.a).toBeUndefined();
  });

  it("buildDownloadsSnapshot mirrors current state", () => {
    useDownloadsStore.getState().upsert(makeItem("a"));
    useDownloadsStore.getState().setProgress("a", { current_time: 3, duration: 9, updatedAt: 2 });
    const snapshot = buildDownloadsSnapshot();
    expect(Object.keys(snapshot.items)).toEqual(["a"]);
    expect(snapshot.progress.a?.current_time).toBe(3);
  });
});
