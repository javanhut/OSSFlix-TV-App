import { useEffect, useState } from "react";

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
