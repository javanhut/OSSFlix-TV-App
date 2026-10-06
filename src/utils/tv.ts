import { type RefObject, useEffect } from "react";
import { Platform, type View } from "react-native";

/** True on Android TV / Google TV (leanback UI mode). */
export const isTV = Platform.isTV;

/**
 * Gives `ref` D-pad focus once it is on screen, on TVs only. (`hasTVPreferredFocus`
 * requests focus before the view is attached under Fabric, so it gets dropped.)
 */
export function useTVPreferredFocus(ref: RefObject<View | null>, wanted = true): void {
  useEffect(() => {
    if (!isTV || !wanted) return;
    const frame = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [ref, wanted]);
}
