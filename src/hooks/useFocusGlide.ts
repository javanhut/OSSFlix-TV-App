import { useCallback, useRef } from "react";
import { type FlatList, type LayoutChangeEvent, Platform } from "react-native";

// Breathing room above the focused row so its scale-up and ring aren't cut off.
const TOP_MARGIN = 14;

/**
 * Hands vertical D-pad scrolling over to JS on a TV. Android's own focus scrolling is an instant
 * jump (`scrollBy`), and the arrow keys would otherwise scroll the list themselves too, so the list
 * stops doing either and the screen glides the focused row into place instead. Offscreen rows stay
 * attached so the remote can still find them.
 */
export const TV_GLIDE_SCROLL_PROPS = Platform.isTV
  ? { scrollEnabled: false, scrollsChildToFocus: false, removeClippedSubviews: false }
  : {};

/**
 * Focus-follow for a vertical list of evenly spaced rows: the focused row glides to `slot` rows
 * from the top (the first rows keep the list at the top, so its header stays in view).
 */
export function useFocusGlide<T>({
  stride,
  slot = 0,
  inset = 0,
  topClearance = 0,
}: {
  /** Row height plus the gap between rows. */
  stride: number;
  slot?: number;
  /** The list's top padding. */
  inset?: number;
  /** Space covered by a see-through header over the list, which the focused row stays below. */
  topClearance?: number;
}) {
  const listRef = useRef<FlatList<T>>(null);
  // Height of the list header (pass `onLeadingLayout` to a View wrapping it).
  const leadingRef = useRef(0);
  const onLeadingLayout = useCallback((event: LayoutChangeEvent) => {
    leadingRef.current = event.nativeEvent.layout.height;
  }, []);
  const glideToRow = useCallback(
    (row: number) => {
      const offset = row <= slot ? 0 : inset + leadingRef.current + (row - slot) * stride - TOP_MARGIN - topClearance;
      listRef.current?.scrollToOffset({ offset: Math.max(0, offset), animated: true });
    },
    [inset, slot, stride, topClearance],
  );
  return { listRef, onLeadingLayout, glideToRow };
}
