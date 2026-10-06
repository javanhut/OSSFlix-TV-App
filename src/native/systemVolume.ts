import { NativeModules, Platform } from "react-native";

type SystemVolumeModuleShape = {
  getMusicVolume(): Promise<number>;
  getMusicVolumeInfo?(): Promise<{ volume?: number; maxVolume?: number }>;
  setMusicVolume(volume: number): Promise<number>;
  setPlayerStream?(): void;
};

export type SystemVolumeInfo = {
  volume: number;
  maxVolume: number;
};

const nativeModule = NativeModules.SystemVolume as SystemVolumeModuleShape | undefined;

function ensureAndroidModule(): SystemVolumeModuleShape | null {
  if (Platform.OS !== "android") return null;
  return nativeModule ?? null;
}

export async function getSystemMusicVolume(): Promise<number> {
  const module = ensureAndroidModule();
  if (!module) return 1;
  const volume = await module.getMusicVolume();
  return Math.max(0, Math.min(volume, 1));
}

export async function getSystemMusicVolumeInfo(): Promise<SystemVolumeInfo> {
  const module = ensureAndroidModule();
  if (!module?.getMusicVolumeInfo) {
    return { volume: await getSystemMusicVolume(), maxVolume: 15 };
  }

  const info = await module.getMusicVolumeInfo();
  return {
    volume: Math.max(0, Math.min(info.volume ?? 1, 1)),
    maxVolume: Math.max(1, Math.round(info.maxVolume ?? 15)),
  };
}

export async function setSystemMusicVolume(volume: number): Promise<number> {
  const module = ensureAndroidModule();
  if (!module) return Math.max(0, Math.min(volume, 1));
  const applied = await module.setMusicVolume(Math.max(0, Math.min(volume, 1)));
  return Math.max(0, Math.min(applied, 1));
}

export function setPlayerVolumeStream(): void {
  const module = ensureAndroidModule();
  module?.setPlayerStream?.();
}
