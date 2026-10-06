import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Pressable } from "./FocusPressable";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";

import { api, resolveAssetUrl } from "../api/client";
import { brandGradient, colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { TitleSummary } from "../types/api";
import { GlassButton, PlayButton } from "./Buttons";
import { SCREEN_GUTTER } from "./PageHero";

const AUTO_ADVANCE_MS = 8000;

function HeroDescription({ dirPath }: { dirPath: string }) {
  // Shares the cache with TitleDetailsScreen, so opening the title afterwards is instant.
  const query = useQuery({
    queryKey: ["title-details", dirPath],
    queryFn: () => api.getTitleDetails(dirPath),
    staleTime: 5 * 60 * 1000,
  });
  if (!query.data?.description) return null;
  return (
    <Text style={styles.description} numberOfLines={3}>
      {query.data.description}
    </Text>
  );
}

/** Full-bleed home hero carousel (web `MediaCarousel`). */
export function FeaturedCarousel({
  items,
  onSelect,
  onPlay,
  height,
}: {
  items: TitleSummary[];
  onSelect: (item: TitleSummary) => void;
  onPlay?: (item: TitleSummary) => void;
  height: number;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  const listRef = useRef<FlatList<TitleSummary>>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (items.length <= 1 || slideWidth === 0) {
      clearTimer();
      return;
    }
    clearTimer();
    timerRef.current = setTimeout(() => {
      const next = (activeIndex + 1) % items.length;
      listRef.current?.scrollToOffset({
        offset: next * slideWidth,
        animated: true,
      });
      setActiveIndex(next);
    }, AUTO_ADVANCE_MS);
    return clearTimer;
  }, [activeIndex, items.length, slideWidth, clearTimer]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (w !== slideWidth) setSlideWidth(w);
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (slideWidth === 0) return;
    const idx = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (clamped !== activeIndex) setActiveIndex(clamped);
  };

  if (!items.length) return null;

  return (
    <View style={[styles.wrapper, { height }]} onLayout={handleLayout}>
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.pathToDir}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        getItemLayout={(_, index) => ({
          length: slideWidth,
          offset: slideWidth * index,
          index,
        })}
        renderItem={({ item, index }) => {
          const imageUrl = resolveAssetUrl(item.imagePath);
          return (
            <View style={[styles.slide, { width: slideWidth, height }]}>
              {imageUrl ? (
                <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
              ) : (
                <View style={[styles.image, styles.imageFallback]} />
              )}
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(7,7,10,0.85)", "rgba(7,7,10,0.35)", "rgba(7,7,10,0)"]}
                locations={[0, 0.5, 1]}
                style={styles.topFade}
              />
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(7,7,10,0)", "rgba(7,7,10,0.6)", colors.background]}
                locations={[0, 0.55, 1]}
                style={styles.bottomFade}
              />
              <View style={styles.content}>
                <Text style={styles.title} numberOfLines={3}>
                  {item.name}
                </Text>
                {index === activeIndex ? <HeroDescription dirPath={item.pathToDir} /> : null}
                <View style={styles.actions}>
                  {onPlay ? (
                    <PlayButton label="Play" large preferredFocus={index === 0} onPress={() => onPlay(item)} />
                  ) : null}
                  <GlassButton
                    label="More Info"
                    icon="info"
                    large
                    preferredFocus={!onPlay && index === 0}
                    onPress={() => onSelect(item)}
                  />
                </View>
              </View>
            </View>
          );
        }}
      />
      {items.length > 1 ? (
        <View style={styles.dots}>
          {items.map((item, idx) =>
            idx === activeIndex ? (
              <LinearGradient
                key={item.pathToDir}
                colors={[...brandGradient]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={[styles.dot, styles.dotActive]}
              />
            ) : (
              <Pressable
                key={item.pathToDir}
                hitSlop={8}
                accessibilityLabel={`Show ${item.name}`}
                onPress={() => {
                  listRef.current?.scrollToOffset({ offset: idx * slideWidth, animated: true });
                  setActiveIndex(idx);
                }}
                style={styles.dot}
              />
            ),
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: -SCREEN_GUTTER,
    marginTop: -SCREEN_GUTTER,
    marginBottom: 20,
  },
  slide: {
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  imageFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  bottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "70%",
  },
  content: {
    position: "absolute",
    left: SCREEN_GUTTER + 4,
    right: SCREEN_GUTTER + 4,
    bottom: 44,
  },
  title: {
    color: "#ffffff",
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -1.3,
  },
  description: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 10,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  dots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  dotActive: {
    width: 28,
  },
});
