import { create } from "zustand";

import type { ProfileData, PublicProfile } from "../types/api";
import type { SessionSnapshot } from "../storage/sessionStorage";

interface SessionState {
  bootstrapped: boolean;
  serverUrl: string | null;
  token: string | null;
  profile: ProfileData | null;
  selectedProfile: PublicProfile | null;
  setBootstrapped: (value: boolean) => void;
  setServerUrl: (serverUrl: string) => void;
  setSelectedProfile: (profile: PublicProfile | null) => void;
  setAuthenticatedSession: (token: string, profile: ProfileData) => void;
  hydrate: (snapshot: SessionSnapshot) => void;
  clearAuth: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  bootstrapped: false,
  serverUrl: null,
  token: null,
  profile: null,
  selectedProfile: null,
  setBootstrapped: (bootstrapped) => set({ bootstrapped }),
  setServerUrl: (serverUrl) =>
    set({
      serverUrl,
      token: null,
      profile: null,
      selectedProfile: null,
    }),
  setSelectedProfile: (selectedProfile) => set({ selectedProfile }),
  setAuthenticatedSession: (token, profile) => set({ token, profile }),
  hydrate: (snapshot) =>
    set({
      serverUrl: snapshot.serverUrl,
      token: snapshot.token,
      profile: snapshot.profile,
      selectedProfile: snapshot.selectedProfile,
      bootstrapped: true,
    }),
  clearAuth: () => set({ token: null, profile: null, selectedProfile: null }),
}));

export function buildSessionSnapshot(): SessionSnapshot {
  const state = useSessionStore.getState();
  return {
    serverUrl: state.serverUrl,
    token: state.token,
    profile: state.profile,
    selectedProfile: state.selectedProfile,
  };
}
