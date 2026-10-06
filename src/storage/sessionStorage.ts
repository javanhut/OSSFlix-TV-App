import * as SecureStore from "expo-secure-store";

import type { ProfileData, PublicProfile } from "../types/api";

const KEYS = {
  serverUrl: "ossflix_mobile_server_url",
  token: "ossflix_mobile_token",
  profile: "ossflix_mobile_profile",
  selectedProfile: "ossflix_mobile_selected_profile",
};

export interface SessionSnapshot {
  serverUrl: string | null;
  token: string | null;
  profile: ProfileData | null;
  selectedProfile: PublicProfile | null;
}

async function readJson<T>(key: string): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  return JSON.parse(raw) as T;
}

async function writeJson<T>(key: string, value: T | null): Promise<void> {
  if (value == null) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await SecureStore.setItemAsync(key, JSON.stringify(value));
}

export async function loadSessionSnapshot(): Promise<SessionSnapshot> {
  const [serverUrl, token, profile, selectedProfile] = await Promise.all([
    SecureStore.getItemAsync(KEYS.serverUrl),
    SecureStore.getItemAsync(KEYS.token),
    readJson<ProfileData>(KEYS.profile),
    readJson<PublicProfile>(KEYS.selectedProfile),
  ]);

  return {
    serverUrl: serverUrl || null,
    token: token || null,
    profile,
    selectedProfile,
  };
}

export async function saveSessionSnapshot(snapshot: SessionSnapshot): Promise<void> {
  await Promise.all([
    snapshot.serverUrl
      ? SecureStore.setItemAsync(KEYS.serverUrl, snapshot.serverUrl)
      : SecureStore.deleteItemAsync(KEYS.serverUrl),
    snapshot.token ? SecureStore.setItemAsync(KEYS.token, snapshot.token) : SecureStore.deleteItemAsync(KEYS.token),
    writeJson(KEYS.profile, snapshot.profile),
    writeJson(KEYS.selectedProfile, snapshot.selectedProfile),
  ]);
}
