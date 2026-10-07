import { type Ref, useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../api/client";
import { EmptyState } from "../components/EmptyState";
import { FeaturedCarousel } from "../components/FeaturedCarousel";
import { Pressable } from "../components/FocusPressable";
import { TitleRail } from "../components/TitleRail";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import { focusGlow } from "../theme/focus";
import { fonts } from "../theme/typography";
import type { TitleSummary } from "../types/api";
import { useNativeHandle } from "../utils/tv";

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
const LIBRARY_POLL_MS = 5 * 60 * 1000;

// Same sections as the web navbar. Also the way into them on TV/landscape, where
// the swipe-in sidebar isn't available.
const BROWSE_LINKS: { label: string; to: (nav: NativeStackNavigationProp<RootStackParamList>) => void }[] = [
  { label: "Movies", to: (nav) => nav.navigate("Library", { type: "Movie", title: "Movies" }) },
  { label: "TV Shows", to: (nav) => nav.navigate("Library", { type: "tv show", title: "TV Shows" }) },
  { label: "Anime", to: (nav) => nav.navigate("Genre", { genre: "Anime" }) },
  { label: "My List", to: (nav) => nav.navigate("Watchlist") },
  { label: "For You", to: (nav) => nav.navigate("Recommendations") },
];

/** A web-navbar-style link: muted until the remote lands on it, then white on a lifted pill. */
function NavLink({ label, onPress, linkRef }: { label: string; onPress: () => void; linkRef?: Ref<View> }) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      ref={linkRef}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      accessibilityRole="link"
      style={styles.navLink}
      focusStyle={[focusGlow, styles.navLinkFocused]}
    >
      <Text style={[styles.navLabel, focused && styles.navLabelFocused]}>{label}</Text>
    </Pressable>
  );
}

export function HomeScreen() {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  // On TV the hero stops short so the first row peeks in below it.
  const heroHeight = isLandscape ? height * 0.72 : Math.min(height * 0.64, 620);
  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
    // A TV can sit on this screen for hours; pick up newly added titles while it does.
    refetchInterval: LIBRARY_POLL_MS,
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
  // --- TV scrolling: a sticky header, with the page gliding the focused row in under it. ---
  const scrollRef = useRef<ScrollView>(null);
  const [scrolled, setScrolled] = useState(false);
  const scrolledRef = useRef(false);
  const headerHeightRef = useRef(0);
  const railsTopRef = useRef(0);
  const railTopsRef = useRef(new Map<string, number>());
  // Up from the hero goes to the header. Left to itself Android picks the sidebar, which is nearer.
  const [firstNavLinkRef, firstNavLinkHandle] = useNativeHandle();

  const openTitle = useCallback(
    (item: TitleSummary) => navigation.navigate("TitleDetails", { dirPath: item.pathToDir }),
    [navigation],
  );
  const scrollToTop = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);
  // Sit the row just under the header. If Android had to nudge a card into view first, this
  // glides the rest of the way; usually it's the whole move, so it never hides under the header.
  const scrollToRail = useCallback((key: string) => {
    const railTop = railTopsRef.current.get(key);
    if (railTop == null) return;
    const y = railsTopRef.current + railTop - headerHeightRef.current;
    scrollRef.current?.scrollTo({ y: Math.max(0, y), animated: true });
  }, []);
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    // Only re-render when the header flips between see-through and solid.
    const next = event.nativeEvent.contentOffset.y > 24;
    if (next !== scrolledRef.current) {
      scrolledRef.current = next;
      setScrolled(next);
    }
  }, []);

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

  const rails = [
    { key: "continue", title: "Continue Watching", items: continueWatchingQuery.data?.titles || [] },
    { key: "my-list", title: "My List", items: watchlistQuery.data?.titles || [] },
    ...categoryRows.map((row) => ({ key: `genre:${row.genre}`, title: row.genre, items: row.titles })),
  ];

  return (
    <View style={styles.screen}>
      <ScrollView
        testID="home-scroll"
        ref={scrollRef}
        style={styles.screen}
        contentContainerStyle={styles.content}
        onScroll={isLandscape ? handleScroll : undefined}
        scrollEventThrottle={32}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />}
      >
        {isLandscape ? (
          // Navy glow behind the first rows. It sits under the hero and starts transparent at the
          // hero's bottom edge, so the hero still meets plain page color there (no seam).
          <View pointerEvents="none" style={[styles.tvGlow, { top: heroHeight, height: height * 1.1 }]}>
            <LinearGradient
              colors={["rgba(16,36,90,0)", "rgba(16,36,90,0.6)", "rgba(16,36,90,0)"]}
              locations={[0, 0.35, 1]}
              style={StyleSheet.absoluteFill}
            />
            {/* Strongest on the left, fading to black toward the right. */}
            <LinearGradient
              colors={["rgba(7,7,10,0)", "rgba(7,7,10,0.85)"]}
              locations={[0.1, 0.85]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : null}
        {featured.length ? (
          <FeaturedCarousel
            items={featured}
            height={heroHeight}
            onSelect={openTitle}
            onPlay={(item) => navigation.navigate("TitleDetails", { dirPath: item.pathToDir, autoplay: true })}
            onFocus={isLandscape ? scrollToTop : undefined}
            nextFocusUp={isLandscape ? firstNavLinkHandle : undefined}
          />
        ) : (
          <View style={{ height: insets.top + 56 }} />
        )}
        {isLandscape ? null : (
          <>
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
          </>
        )}
        <View
          style={isLandscape ? styles.tvRails : undefined}
          onLayout={(event) => {
            railsTopRef.current = event.nativeEvent.layout.y;
          }}
        >
          {rails.map((rail, index) => (
            <View
              key={rail.key}
              onLayout={(event) => {
                railTopsRef.current.set(rail.key, event.nativeEvent.layout.y);
              }}
            >
              <TitleRail
                title={rail.title}
                items={rail.items}
                onSelect={openTitle}
                onRowFocus={isLandscape ? () => scrollToRail(rail.key) : undefined}
              />
              {index === 1 && !categoryRows.length && !allCategoryRows.length ? (
                <EmptyState
                  title="No library data yet"
                  subtitle="Once the server has scanned media, your categories will appear here."
                />
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
      {isLandscape ? (
        // TV: the web navbar, pinned. See-through over the hero; solid navy glass once the page
        // scrolls into the rows (the web's `.scrolled`). Press up from the hero to reach it.
        <View
          testID="tv-header"
          style={[styles.navBar, { paddingTop: insets.top + 14 }, scrolled && styles.navBarSolid]}
          onLayout={(event) => {
            headerHeightRef.current = event.nativeEvent.layout.height;
          }}
        >
          <Text style={styles.navBrand} accessibilityRole="header">
            Reelscape
          </Text>
          <View style={styles.navLinks}>
            {BROWSE_LINKS.map((link, index) => (
              <NavLink
                key={link.label}
                label={link.label}
                onPress={() => link.to(navigation)}
                linkRef={index === 0 ? firstNavLinkRef : undefined}
              />
            ))}
          </View>
        </View>
      ) : null}
    </View>
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
  navBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 34,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 28,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "transparent",
  },
  navBarSolid: {
    backgroundColor: "rgba(6,12,30,0.92)",
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  navBrand: {
    color: colors.accentText,
    fontFamily: fonts.display,
    fontSize: 26,
    letterSpacing: -1.1,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  navLinks: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  navLink: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  navLinkFocused: {
    backgroundColor: colors.surfaceHover,
  },
  navLabel: {
    color: "rgba(255,255,255,0.72)",
    fontFamily: fonts.bodyMedium,
    fontSize: 15,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
  navLabelFocused: {
    color: "#ffffff",
  },
  tvGlow: {
    position: "absolute",
    left: 0,
    right: 0,
  },
  // Web rows sit at 4% from the edge; the content padding already gives part of that.
  tvRails: {
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  loading: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
