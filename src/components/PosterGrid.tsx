import type { ReactElement } from "react";
import { FlatList, RefreshControl, StyleSheet } from "react-native";

import { GRID_GAP, usePosterGrid } from "../hooks/usePosterGrid";
import { colors } from "../theme/colors";
import type { TitleSummary } from "../types/api";
import { SCREEN_GUTTER } from "./PageHero";
import { TitleCard } from "./TitleCard";

/** Full-screen poster grid with a header (usually a PageHero) above it. */
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

  return (
    <FlatList
      // numColumns can't change on the fly; remount when the column count does.
      key={columns}
      data={items}
      keyExtractor={(item) => item.pathToDir}
      numColumns={columns}
      columnWrapperStyle={styles.row}
      style={styles.screen}
      contentContainerStyle={styles.list}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        ) : undefined
      }
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      renderItem={({ item }) => (
        <TitleCard item={item} width={cardWidth} style={styles.card} onPress={() => onSelect(item)} />
      )}
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
