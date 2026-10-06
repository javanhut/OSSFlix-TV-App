import { useEffect, useRef } from "react";
import { DeviceEventEmitter } from "react-native";

export type RemoteKey =
  | "up"
  | "down"
  | "left"
  | "right"
  | "select"
  | "playPause"
  | "play"
  | "pause"
  | "fastForward"
  | "rewind"
  | "menu";

export type RemoteKeyEvent = { key: RemoteKey; repeatCount: number };

// Emitted by android/.../RemoteKeyEmitter.kt for every D-pad / media key press.
export const REMOTE_KEY_EVENT = "remoteKey";

/** Calls `handler` for each TV remote / D-pad / media key press while mounted. */
export function useRemoteKeys(handler: (event: RemoteKeyEvent) => void, enabled = true): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const sub = DeviceEventEmitter.addListener(REMOTE_KEY_EVENT, (event: RemoteKeyEvent) => {
      handlerRef.current(event);
    });
    return () => sub.remove();
  }, [enabled]);
}
