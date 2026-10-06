import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { PageHero } from "../components/PageHero";
import { PosterGrid } from "../components/PosterGrid";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import { useAllowRotation } from "../hooks/useAllowRotation";

export function WatchlistScreen() {
  useAllowRotation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const query = useQuery({
    queryKey: ["watchlist"],
    queryFn: api.getWatchlist,
  });

  if (query.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const items = query.data?.titles || [];

  return (
    <PosterGrid
      items={items}
      refreshing={query.isRefetching}
      onRefresh={() => void query.refetch()}
      onSelect={(item) => navigation.navigate("TitleDetails", { dirPath: item.pathToDir })}
      header={
        <PageHero
          title="My List"
          subtitle={`${items.length} saved ${items.length === 1 ? "title" : "titles"} · Everything you've saved to watch next.`}
          images={items.map((item) => item.imagePath)}
        />
      }
      empty={<EmptyState title="Your list is empty." subtitle="Add titles from their detail page." />}
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
