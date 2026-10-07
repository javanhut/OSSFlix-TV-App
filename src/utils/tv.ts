import { useCallback, useEffect, useState } from "react";
import { findNodeHandle, type View } from "react-native";

/**
 * The `hasTVPreferredFocus` value for a view that should take D-pad focus while `wanted`.
 *
 * It turns true one frame after the view mounts, because Android only requests focus when the
 * prop changes, and under Fabric a value present at mount is applied before the view is attached,
 * so the request is dropped. (`ref.focus()` is no help: on a plain View it is a no-op unless RN's
 * `enableImperativeFocus` flag is on.) Going false → true again re-focuses, e.g. when the player
 * controls reappear.
 */
export function useTVPreferredFocus(wanted = true): boolean {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!wanted) {
      setArmed(false);
      return;
    }
    const frame = requestAnimationFrame(() => setArmed(true));
    return () => cancelAnimationFrame(frame);
  }, [wanted]);
  return wanted && armed;
}

/**
 * A callback ref plus that view's native handle, for Android's `nextFocus*` props (which take a
 * handle, not a ref). The handle is undefined until the view mounts, or while `enabled` is false.
 */
export function useNativeHandle(enabled = true): [(node: View | null) => void, number | undefined] {
  const [handle, setHandle] = useState<number>();
  const ref = useCallback(
    (node: View | null) => setHandle(enabled && node ? (findNodeHandle(node) ?? undefined) : undefined),
    [enabled],
  );
  return [ref, handle];
}
