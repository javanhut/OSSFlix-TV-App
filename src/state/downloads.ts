import { create } from "zustand";

import type { DownloadItem, DownloadsSnapshot, OfflineProgress } from "../types/downloads";

interface DownloadsState {
  bootstrapped: boolean;
  items: Record<string, DownloadItem>;
  progress: Record<string, OfflineProgress>;
  hydrate: (snapshot: DownloadsSnapshot) => void;
  upsert: (item: DownloadItem) => void;
  patch: (id: string, partial: Partial<DownloadItem>) => void;
  remove: (id: string) => void;
  setProgress: (id: string, progress: OfflineProgress) => void;
}

export const useDownloadsStore = create<DownloadsState>((set) => ({
  bootstrapped: false,
  items: {},
  progress: {},
  hydrate: (snapshot) =>
    set({
      items: snapshot.items ?? {},
      progress: snapshot.progress ?? {},
      bootstrapped: true,
    }),
  upsert: (item) => set((state) => ({ items: { ...state.items, [item.id]: item } })),
  patch: (id, partial) =>
    set((state) => {
      const existing = state.items[id];
      if (!existing) return state;
      return { items: { ...state.items, [id]: { ...existing, ...partial } } };
    }),
  remove: (id) =>
    set((state) => {
      const items = { ...state.items };
      delete items[id];
      return { items };
    }),
  setProgress: (id, progress) => set((state) => ({ progress: { ...state.progress, [id]: progress } })),
}));

export function buildDownloadsSnapshot(): DownloadsSnapshot {
  const state = useDownloadsStore.getState();
  return { items: state.items, progress: state.progress };
}
