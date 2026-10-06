import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { FeaturedCarousel } from "../components/FeaturedCarousel";
import { Pressable } from "../components/FocusPressable";
import { TitleRail } from "../components/TitleRail";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { TitleSummary } from "../types/api";

const BASIC_GENRES = new Set([
  "Newly Added",
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Fantasy",
  "Horror",
  "Romance",
  "Thriller",
  "Family",
  "Science Fiction",
  "Mystery",
  "Documentary",
]);

const FEATURED_LIMIT = 6;

// Same sections as the web navbar. Also the way into them on TV/landscape, where
// the swipe-in sidebar isn't available.
const BROWSE_LINKS: { label: string; to: (nav: NativeStackNavigationProp<RootStackParamList>) => void }[] = [
  { label: "Movies", to: (nav) => nav.navigate("Library", { type: "Movie", title: "Movies" }) },
  { label: "TV Shows", to: (nav) => nav.navigate("Library", { type: "tv show", title: "TV Shows" }) },
  { label: "Anime", to: (nav) => nav.navigate("Genre", { genre: "Anime" }) },
  { label: "My List", to: (nav) => nav.navigate("Watchlist") },
  { label: "For You", to: (nav) => nav.navigate("Recommendations") },
];

export function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const heroHeight = isLandscape ? height * 0.85 : Math.min(height * 0.64, 620);
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });
  const continueWatchingQuery = useQuery({
    queryKey: ["continue-watching"],
    queryFn: api.getContinueWatching,
  });
  const watchlistQuery = useQuery({
    queryKey: ["watchlist"],
    queryFn: api.getWatchlist,
  });

  const loading = categoriesQuery.isLoading || continueWatchingQuery.isLoading || watchlistQuery.isLoading;
  const refreshing = categoriesQuery.isRefetching || continueWatchingQuery.isRefetching || watchlistQuery.isRefetching;
  const handleRefresh = () => {
    void Promise.all([categoriesQuery.refetch(), continueWatchingQuery.refetch(), watchlistQuery.refetch()]);
  };
  const allCategoryRows = categoriesQuery.data || [];
  const categoryRows = allCategoryRows.filter((row) => BASIC_GENRES.has(row.genre));

  const featured = (() => {
    const newlyAdded = allCategoryRows.find((row) => row.genre === "Newly Added");
    const source: TitleSummary[] = newlyAdded ? newlyAdded.titles : allCategoryRows.flatMap((row) => row.titles);
    const seen = new Set<string>();
    const picked: TitleSummary[] = [];
    for (const t of source) {
      if (!t.imagePath) continue;
      if (seen.has(t.pathToDir)) continue;
      seen.add(t.pathToDir);
      picked.push(t);
      if (picked.length >= FEATURED_LIMIT) break;
    }
    return picked;
  })();

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
    >
      {featured.length ? (
        <FeaturedCarousel
          items={featured}
          height={heroHeight}
          onSelect={(item) => navigation.navigate("TitleDetails", { dirPath: item.pathToDir })}
          onPlay={(item) => navigation.navigate("TitleDetails", { dirPath: item.pathToDir, autoplay: true })}
        />
      ) : (
        <View style={{ height: insets.top + 56 }} />
      )}
      <Text style={[styles.brand, { top: insets.top + 12 }]} accessibilityRole="header">
        Reelscape
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.browseRow}
        contentContainerStyle={styles.browseRowContent}
      >
        {BROWSE_LINKS.map((link) => (
          <Pressable
            key={link.label}
            onPress={() => link.to(navigation)}
            accessibilityRole="link"
            style={({ pressed }) => [styles.browsePill, pressed && styles.browsePillPressed]}
          >
            <Text style={styles.browseLabel}>{link.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <TitleRail
        title="Continue Watching"
        items={continueWatchingQuery.data?.titles || []}
        onSelect={(item) => navigation.navigate("TitleDetails", { dirPath: item.pathToDir })}
      />
      <TitleRail
        title="My List"
        items={watchlistQuery.data?.titles || []}
        onSelect={(item) => navigation.navigate("TitleDetails", { dirPath: item.pathToDir })}
      />
      {!categoryRows.length && !allCategoryRows.length ? (
        <EmptyState
          title="No library data yet"
          subtitle="Once the server has scanned media, your categories will appear here."
        />
      ) : null}
      {categoryRows.map((row) => (
        <TitleRail
          key={row.genre}
          title={row.genre}
          items={row.titles}
          onSelect={(item) => navigation.navigate("TitleDetails", { dirPath: item.pathToDir })}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 18,
    paddingBottom: 48,
  },
  brand: {
    position: "absolute",
    left: 22,
    color: colors.accentText,
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: -1.2,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  browseRow: {
    marginHorizontal: -18,
    marginBottom: 22,
  },
  browseRowContent: {
    paddingHorizontal: 18,
    gap: 10,
  },
  browsePill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderBright,
    backgroundColor: colors.glass,
  },
  browsePillPressed: {
    backgroundColor: colors.surfaceHover,
  },
  browseLabel: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
