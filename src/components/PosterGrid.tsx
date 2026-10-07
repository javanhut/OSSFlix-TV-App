import { type ReactElement, useCallback, useRef } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TV_GLIDE_SCROLL_PROPS, useFocusGlide } from "../hooks/useFocusGlide";
import { GRID_GAP, usePosterGrid } from "../hooks/usePosterGrid";
import { colors } from "../theme/colors";
import type { TitleSummary } from "../types/api";
import { HEADER_SPACE, SCREEN_GUTTER } from "./PageHero";
import { TitleCard } from "./TitleCard";

const keyExtractor = (item: TitleSummary) => item.pathToDir;

/** Full-screen poster grid with a header (usually a PageHero) above it, under the see-through stack header. */
export function PosterGrid({
  items,
  header,
  empty,
  refreshing,
  onRefresh,
  onSelect,
}: {
  items: TitleSummary[];
  header: ReactElement;
  empty: ReactElement;
  refreshing?: boolean;
  onRefresh?: () => void;
  onSelect: (item: TitleSummary) => void;
}) {
  const { columns, cardWidth } = usePosterGrid();
  const insets = useSafeAreaInsets();
  const { listRef, onLeadingLayout, glideToRow } = useFocusGlide<TitleSummary>({
    stride: cardWidth * 1.5 + GRID_GAP,
    inset: SCREEN_GUTTER,
    topClearance: insets.top + HEADER_SPACE,
  });
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const handleCardFocus = useCallback(
    (item: TitleSummary) => {
      const index = itemsRef.current.indexOf(item);
      if (index >= 0) glideToRow(Math.floor(index / columns));
    },
    [columns, glideToRow],
  );
  // Stable so a focus change doesn't re-render every card.
  const renderItem = useCallback(
    ({ item }: { item: TitleSummary }) => (
      <TitleCard item={item} width={cardWidth} style={styles.card} onPress={onSelect} onFocus={handleCardFocus} />
    ),
    [cardWidth, onSelect, handleCardFocus],
  );

  return (
    <FlatList
      ref={listRef}
      // numColumns can't change on the fly; remount when the column count does.
      key={columns}
      testID="poster-grid"
      data={items}
      keyExtractor={keyExtractor}
      numColumns={columns}
      columnWrapperStyle={styles.row}
      style={styles.screen}
      contentContainerStyle={styles.list}
      {...TV_GLIDE_SCROLL_PROPS}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined
      }
      ListHeaderComponent={<View onLayout={onLeadingLayout}>{header}</View>}
      ListEmptyComponent={empty}
      renderItem={renderItem}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  list: {
    padding: SCREEN_GUTTER,
    paddingBottom: 40,
    flexGrow: 1,
  },
  row: {
    gap: GRID_GAP,
    marginBottom: GRID_GAP,
  },
  card: {
    marginRight: 0,
  },
});
