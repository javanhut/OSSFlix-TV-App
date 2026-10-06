import { type RefObject, useEffect } from "react";
import type { View } from "react-native";

/**
 * Gives `ref` D-pad focus once it is on screen. (`hasTVPreferredFocus` requests focus
 * before the view is attached under Fabric, so it gets dropped.)
 */
export function useTVPreferredFocus(ref: RefObject<View | null>, wanted = true): void {
  useEffect(() => {
    if (!wanted) return;
    const frame = requestAnimationFrame(() => ref.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [ref, wanted]);
}
