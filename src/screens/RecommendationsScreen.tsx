import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { PageHero, SCREEN_GUTTER } from "../components/PageHero";
import { TitleRail } from "../components/TitleRail";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import type { Recommendation } from "../types/api";

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
      style={styles.screen}
      contentContainerStyle={styles.content}
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
        groups.map((group) => (
          <TitleRail
            key={group.title}
            title={group.title}
            items={group.items}
            onSelect={(item) => navigation.navigate("TitleDetails", { dirPath: item.pathToDir })}
          />
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
