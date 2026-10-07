import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Image,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "./FocusPressable";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";

import { api, resolveAssetUrl } from "../api/client";
import { brandGradient, colors } from "../theme/colors";
import { focusGlow } from "../theme/focus";
import { fonts } from "../theme/typography";
import type { TitleSummary } from "../types/api";
import { GlassButton, PlayButton } from "./Buttons";
import { SCREEN_GUTTER } from "./PageHero";

const AUTO_ADVANCE_MS = 8000;
// Like the web hero: art narrower than this (a poster) gets a blurred backdrop with the sharp poster
// floating on the right, instead of being magnified to fill a wide stage.
const PORTRAIT_MAX_ASPECT = 1.3;

/** Slide artwork. `wideStage` (TV/landscape) uses the web's poster treatment for portrait art. */
function HeroArt({ uri, wideStage, height }: { uri: string | null; wideStage: boolean; height: number }) {
  const [measured, setMeasured] = useState<{ uri: string; aspect: number } | null>(null);
  if (!uri) return <View style={[styles.image, styles.imageFallback]} />;
  const aspect = measured && measured.uri === uri ? measured.aspect : null;
  // Library art is almost always a poster, so assume that until the image says otherwise.
  const portrait = aspect == null || aspect < PORTRAIT_MAX_ASPECT;
  const onLoad = (event: { nativeEvent: { source: { width: number; height: number } } }) => {
    const { width: w, height: h } = event.nativeEvent.source;
    if (w > 0 && h > 0) setMeasured({ uri, aspect: w / h });
  };
  if (!wideStage || !portrait) {
    return <Image source={{ uri }} style={styles.image} resizeMode="cover" onLoad={onLoad} />;
  }
  const posterTop = 64 + height * 0.05;
  const posterHeight = height * 0.86 - posterTop;
  return (
    <>
      <Image source={{ uri }} style={styles.image} resizeMode="cover" blurRadius={30} />
      {/* Stands in for the web's brightness(.55) on the blurred backdrop. */}
      <View style={[styles.image, styles.backdropDim]} />
      <Image
        testID="hero-poster"
        source={{ uri }}
        style={[styles.poster, { top: posterTop, height: posterHeight, width: (posterHeight * 2) / 3 }]}
        resizeMode="cover"
        onLoad={onLoad}
      />
    </>
  );
}

function HeroDescription({ dirPath, lines }: { dirPath: string; lines: number }) {
  // Shares the cache with TitleDetailsScreen, so opening the title afterwards is instant.
  const query = useQuery({
    queryKey: ["title-details", dirPath],
    queryFn: () => api.getTitleDetails(dirPath),
    staleTime: 5 * 60 * 1000,
  });
  if (!query.data?.description) return null;
  return (
    <Text style={styles.description} numberOfLines={lines}>
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
  onFocus,
  nextFocusUp,
}: {
  items: TitleSummary[];
  onSelect: (item: TitleSummary) => void;
  onPlay?: (item: TitleSummary) => void;
  height: number;
  /** A hero button got D-pad focus (the home screen scrolls back to the top). */
  onFocus?: () => void;
  /** Where D-pad up from the hero's buttons goes (the home header), as a native view handle. */
  nextFocusUp?: number;
}) {
  const screen = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideWidth, setSlideWidth] = useState(0);
  // While the remote is on the hero, focus moves with the slides: otherwise an auto-advance would
  // leave it on the previous slide's (now offscreen) Play, and OK would play the wrong title.
  // The slide whose Play takes focus; the first one when the screen opens.
  const [focusSlide, setFocusSlide] = useState<number | null>(0);
  const focusInHeroRef = useRef(false);
  const handleButtonFocus = useCallback(() => {
    focusInHeroRef.current = true;
    onFocus?.();
  }, [onFocus]);
  const handleButtonBlur = useCallback(() => {
    focusInHeroRef.current = false;
  }, []);
  const showSlide = useCallback((index: number) => {
    setActiveIndex(index);
    setFocusSlide(focusInHeroRef.current ? index : null);
  }, []);
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
      showSlide(next);
    }, AUTO_ADVANCE_MS);
    return clearTimer;
  }, [activeIndex, items.length, slideWidth, clearTimer, showSlide]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (w !== slideWidth) setSlideWidth(w);
  };

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (slideWidth === 0) return;
    const idx = Math.round(event.nativeEvent.contentOffset.x / slideWidth);
    const clamped = Math.max(0, Math.min(items.length - 1, idx));
    if (clamped !== activeIndex) showSlide(clamped);
  };

  if (!items.length) return null;

  const wideStage = slideWidth > height;
  // Web: title clamp(1.8rem, 7vh, 3.6rem); description drops to 2 lines on short screens.
  const titleSize = Math.max(29, Math.min(58, screen.height * 0.07));
  const descriptionLines = screen.height <= 700 ? 2 : 3;

  return (
    <View testID="featured-carousel" style={[styles.wrapper, { height }]} onLayout={handleLayout}>
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
              <HeroArt uri={imageUrl} wideStage={wideStage} height={height} />
              {/* The web hero's vignette: dark under the nav, navy behind the copy, then the bottom
                  fade last so the hero always ends in the plain page color (no seam with the rows). */}
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(7,7,10,0.85)", "rgba(7,7,10,0.35)", "rgba(7,7,10,0)"]}
                locations={[0, 0.5, 1]}
                style={styles.topFade}
              />
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(5,12,34,0.9)", "rgba(8,20,56,0.5)", "rgba(8,20,56,0)"]}
                locations={[0, 0.38, 0.65]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(7,7,10,0)", "rgba(7,7,10,0.6)", colors.background]}
                locations={[0.5, 0.78, 1]}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.content, wideStage && styles.contentWide]}>
                <Text
                  style={[styles.title, wideStage && { fontSize: titleSize, lineHeight: titleSize * 1.04 }]}
                  numberOfLines={3}
                >
                  {item.name}
                </Text>
                {index === activeIndex ? <HeroDescription dirPath={item.pathToDir} lines={descriptionLines} /> : null}
                <View style={styles.actions}>
                  {onPlay ? (
                    <PlayButton
                      label="Play"
                      large
                      preferredFocus={index === focusSlide}
                      onPress={() => onPlay(item)}
                      iconNode={<Ionicons name="play" size={18} color={colors.playText} />}
                      style={styles.actionButton}
                      focusStyle={focusGlow}
                      onFocus={handleButtonFocus}
                      onBlur={handleButtonBlur}
                      nextFocusUp={nextFocusUp}
                    />
                  ) : null}
                  <GlassButton
                    label="More Info"
                    icon="info"
                    large
                    preferredFocus={!onPlay && index === focusSlide}
                    onPress={() => onSelect(item)}
                    style={styles.actionButton}
                    focusStyle={focusGlow}
                    onFocus={handleButtonFocus}
                    onBlur={handleButtonBlur}
                    nextFocusUp={nextFocusUp}
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
                // Touch only: on a TV the dots would be an extra stop between the hero and the rows,
                // and pressing one removes it (the active dot isn't a button), dropping focus. On
                // Android an accessible view is focusable too, so both are off there.
                focusable={!Platform.isTV}
                accessible={!Platform.isTV}
                hitSlop={8}
                accessibilityLabel={`Show ${item.name}`}
                onPress={() => {
                  listRef.current?.scrollToOffset({ offset: idx * slideWidth, animated: true });
                  showSlide(idx);
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
  // Darkens the blurred backdrop (the web's brightness(.55)) with a navy cast.
  backdropDim: {
    backgroundColor: "rgba(4,10,30,0.5)",
  },
  poster: {
    position: "absolute",
    right: "7%",
    borderRadius: 16,
    boxShadow: "0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.08)",
  },
  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 120,
  },
  content: {
    position: "absolute",
    left: SCREEN_GUTTER + 4,
    right: SCREEN_GUTTER + 4,
    bottom: 44,
  },
  // Web: bottom 16%, left 4%, max-width min(600px, 58%).
  contentWide: {
    left: "4%",
    right: undefined,
    bottom: "16%",
    width: "58%",
    maxWidth: 600,
  },
  title: {
    color: "#ffffff",
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -1.3,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  description: {
    color: "rgba(255,255,255,0.78)",
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 22,
  },
  actionButton: {
    paddingHorizontal: 30,
    paddingVertical: 13,
  },
  dots: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: "5%",
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
