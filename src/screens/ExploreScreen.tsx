import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { Pressable } from "../components/FocusPressable";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { PageHero, SCREEN_GUTTER } from "../components/PageHero";
import { TV_GLIDE_SCROLL_PROPS, useFocusGlide } from "../hooks/useFocusGlide";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { brandGradient, colors } from "../theme/colors";
import { focusGlow } from "../theme/focus";
import { fonts } from "../theme/typography";
import type { CategoryRow } from "../types/api";

const COLUMNS = 2;
// Fixed so the list knows where each row is when it glides to the focused tile.
const TILE_HEIGHT = 128;
const TILE_GAP = 12;

export function ExploreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });
  const { listRef, onLeadingLayout, glideToRow } = useFocusGlide<CategoryRow>({
    stride: TILE_HEIGHT + TILE_GAP,
    slot: 1,
    inset: SCREEN_GUTTER,
  });

  if (query.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const rows = (query.data || []).filter((r) => r.titles.length > 0);

  return (
    <FlatList
      ref={listRef}
      testID="explore-grid"
      data={rows}
      keyExtractor={(row) => row.genre}
      numColumns={COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.list}
      {...TV_GLIDE_SCROLL_PROPS}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          tintColor={colors.primary}
        />
      }
      ListHeaderComponent={
        <View onLayout={onLeadingLayout}>
          <PageHero
            title="Explore"
            subtitle="Browse every genre and tag in your library."
            images={rows.flatMap((row) => row.titles.slice(0, 2).map((t) => t.imagePath))}
          />
        </View>
      }
      ListEmptyComponent={
        <EmptyState
          title="No categories yet"
          subtitle="Once the server has scanned media, categories will appear here."
        />
      }
      renderItem={({ item, index }) => (
        <Pressable
          onPress={() => navigation.navigate("Genre", { genre: item.genre })}
          onFocus={() => glideToRow(Math.floor(index / COLUMNS))}
          style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
          focusStyle={[focusGlow, styles.tileFocused]}
        >
          <LinearGradient
            colors={[...brandGradient]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={styles.tileAccent}
          />
          <Text style={styles.tileTitle} numberOfLines={2}>
            {item.genre}
          </Text>
          <View style={styles.tileFooter}>
            <Text style={styles.tileCount}>{item.titles.length} titles</Text>
            <Feather name="arrow-right" size={16} color={colors.textSoft} />
          </View>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    padding: SCREEN_GUTTER,
    paddingBottom: 36,
    backgroundColor: colors.background,
    flexGrow: 1,
  },
  row: {
    gap: TILE_GAP,
    marginBottom: TILE_GAP,
  },
  tile: {
    flex: 1,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    height: TILE_HEIGHT,
    justifyContent: "space-between",
  },
  tileFocused: {
    backgroundColor: "rgba(23,52,130,0.9)",
    borderColor: "#60a5fa",
  },
  tilePressed: {
    backgroundColor: colors.surfaceHover,
    borderColor: colors.borderBright,
  },
  tileAccent: {
    width: 30,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginBottom: 10,
  },
  tileTitle: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 17,
    letterSpacing: -0.3,
  },
  tileFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
  },
  tileCount: {
    color: colors.textMuted,
    fontFamily: fonts.bodyMedium,
    fontSize: 12,
  },
});
