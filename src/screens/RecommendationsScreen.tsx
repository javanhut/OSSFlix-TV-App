import { useCallback, useRef } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { HEADER_SPACE, PageHero, SCREEN_GUTTER } from "../components/PageHero";
import { TitleRail } from "../components/TitleRail";
import { TV_GLIDE_SCROLL_PROPS } from "../hooks/useFocusGlide";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import type { Recommendation } from "../types/api";

// Room above a focused row for its cards' scale-up and ring.
const RAIL_TOP_MARGIN = 8;

// Group by the first genre in "Because you watch Action, Drama", like the web For You page.
export function groupRecommendations(recs: Recommendation[]): { title: string; items: Recommendation[] }[] {
  const grouped = new Map<string, Recommendation[]>();
  for (const rec of recs) {
    const match = rec.reason?.match(/Because you watch (.+)/);
    const topGenre = (match ? match[1]!.split(", ")[0] : null) || "Recommended";
    const key = topGenre === "Recommended" ? topGenre : `Because you watch ${topGenre}`;
    const list = grouped.get(key);
    if (list) list.push(rec);
    else grouped.set(key, [rec]);
  }
  return [...grouped].map(([title, items]) => ({ title, items }));
}

export function RecommendationsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const query = useQuery({
    queryKey: ["recommendations"],
    queryFn: () => api.getRecommendations(),
  });
  // TV: the page glides the focused row to just under the see-through header (the first row only
  // as far as it needs to, so the hero stays in view above it).
  const insets = useSafeAreaInsets();
  const headerClearance = insets.top + HEADER_SPACE;
  const scrollRef = useRef<ScrollView>(null);
  const viewportHeightRef = useRef(0);
  const railLayoutsRef = useRef(new Map<string, { y: number; height: number }>());
  const glideToRail = useCallback(
    (key: string, first: boolean) => {
      const rail = railLayoutsRef.current.get(key);
      if (!rail) return;
      const y = first
        ? rail.y + rail.height - viewportHeightRef.current + RAIL_TOP_MARGIN
        : rail.y - RAIL_TOP_MARGIN - headerClearance;
      scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
    },
    [headerClearance],
  );

  if (query.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const recs = query.data || [];
  const groups = groupRecommendations(recs);

  return (
    <ScrollView
      ref={scrollRef}
      testID="recommendations-scroll"
      style={styles.screen}
      contentContainerStyle={styles.content}
      onLayout={(event) => {
        viewportHeightRef.current = event.nativeEvent.layout.height;
      }}
      {...TV_GLIDE_SCROLL_PROPS}
      refreshControl={
        <RefreshControl
          refreshing={query.isRefetching}
          onRefresh={() => void query.refetch()}
          tintColor={colors.primary}
        />
      }
    >
      <PageHero
        title="For You"
        subtitle="Recommendations based on your watch history."
        images={recs.map((rec) => rec.imagePath)}
      />
      {groups.length ? (
        groups.map((group, index) => (
          <View
            key={group.title}
            onLayout={(event) => {
              const { y, height } = event.nativeEvent.layout;
              railLayoutsRef.current.set(group.title, { y, height });
            }}
          >
            <TitleRail
              title={group.title}
              items={group.items}
              onSelect={(item) => navigation.navigate("TitleDetails", { dirPath: item.pathToDir })}
              onRowFocus={() => glideToRail(group.title, index === 0)}
            />
          </View>
        ))
      ) : (
        <EmptyState
          title="No recommendations yet."
          subtitle="Start watching something and we'll suggest similar titles!"
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: SCREEN_GUTTER,
    paddingBottom: 40,
  },
});
