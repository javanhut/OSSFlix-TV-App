import { useMemo } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { type RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { PageHero } from "../components/PageHero";
import { PosterGrid } from "../components/PosterGrid";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import { useAllowRotation } from "../hooks/useAllowRotation";

const ANIME_ALIASES = new Set(["anime", "animation"]);

export function GenreScreen() {
  useAllowRotation();
  const route = useRoute<RouteProp<RootStackParamList, "Genre">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { genre } = route.params;
  const query = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });

  const row = useMemo(() => {
    const rows = query.data || [];
    const needle = genre.toLowerCase();
    const direct = rows.find((r) => r.genre.toLowerCase() === needle);
    if (direct) return direct;
    if (ANIME_ALIASES.has(needle)) {
      return rows.find((r) => r.genre.toLowerCase() === "anime") ?? null;
    }
    return null;
  }, [query.data, genre]);

  if (query.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const items = row?.titles || [];
  const isAnime = ANIME_ALIASES.has(genre.toLowerCase());
  const count = `${items.length} ${items.length === 1 ? "title" : "titles"}`;
  const subtitle = isAnime
    ? `${count} · Series and films from the world of anime.`
    : row
      ? `${count} · Everything tagged ${row.genre}.`
      : `No titles tagged "${genre}" yet.`;

  return (
    <PosterGrid
      items={items}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      onSelect={(item) => navigation.navigate("TitleDetails", { dirPath: item.pathToDir })}
      header={<PageHero title={row?.genre || genre} subtitle={subtitle} images={items.map((i) => i.imagePath)} />}
      empty={
        <EmptyState
          title={isAnime ? "No anime found." : `No ${genre} titles`}
          subtitle="Nothing in this genre is indexed on this server."
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
});
