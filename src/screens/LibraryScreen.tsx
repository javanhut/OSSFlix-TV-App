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

// Same copy as the web Movies / TV Shows pages.
function librarySubtitle(type: string, count: number): string {
  if (type.toLowerCase() === "movie") {
    return `${count} ${count === 1 ? "movie" : "movies"} · Every film in your library, ready when you are.`;
  }
  if (type.toLowerCase() === "tv show") {
    return `${count} series · Binge-worthy shows, right where you left off.`;
  }
  return `${count} ${count === 1 ? "title" : "titles"}`;
}

export function LibraryScreen() {
  useAllowRotation();
  const route = useRoute<RouteProp<RootStackParamList, "Library">>();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { type, title } = route.params;
  const query = useQuery({
    queryKey: ["library", type],
    queryFn: () => api.getLibrary(type),
  });

  if (query.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const items = query.data || [];

  return (
    <PosterGrid
      items={items}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      onSelect={(item) => navigation.navigate("TitleDetails", { dirPath: item.pathToDir })}
      header={
        <PageHero
          title={title}
          subtitle={librarySubtitle(type, items.length)}
          images={items.map((item) => item.imagePath)}
        />
      }
      empty={
        <EmptyState
          title={`No ${title.toLowerCase()} found.`}
          subtitle="This server has not scanned any matching titles yet."
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
