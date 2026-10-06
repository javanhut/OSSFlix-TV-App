import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { resolveAssetUrl } from "../api/client";

const TILES_PER_COLUMN = 6;
const GAP = 12;
// Below this many posters the wall mixes in abstract tiles so it doesn't look repetitive.
const SPARSE_THRESHOLD = 8;

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) setReduce(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

function AbstractTile({ n }: { n: number }) {
  const hue = 205 + ((n * 23) % 60);
  return (
    <LinearGradient
      colors={[`hsla(${hue}, 90%, 65%, 0.7)`, `hsl(${hue}, 55%, 26%)`, `hsl(${hue + 20}, 55%, 11%)`]}
      locations={[0, 0.45, 1]}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.85, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}

function WallColumn({
  tiles,
  tileWidth,
  reverse,
  animate,
}: {
  tiles: (string | null)[];
  tileWidth: number;
  reverse: boolean;
  animate: boolean;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const tileHeight = tileWidth * 1.5;
  const loopHeight = TILES_PER_COLUMN * (tileHeight + GAP);

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: reverse ? 75_000 : 60_000,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animate, progress, reverse]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: reverse ? [-loopHeight, 0] : [0, -loopHeight],
  });

  // Rendered twice so the column can scroll by half its height and loop seamlessly.
  const doubled = [...tiles, ...tiles];
  return (
    <Animated.View style={[styles.column, { width: tileWidth, transform: [{ translateY }] }]}>
      {doubled.map((uri, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: tiles repeat by design and never reorder
          key={i}
          style={[styles.tile, { width: tileWidth, height: tileHeight }]}
        >
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <AbstractTile n={i % TILES_PER_COLUMN} />
          )}
        </View>
      ))}
    </Animated.View>
  );
}

/** Slowly drifting, tilted grid of posters (web `PosterWall`). */
export function PosterWall({
  images = [],
  columns = 4,
  style,
}: {
  images?: (string | null | undefined)[];
  columns?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [width, setWidth] = useState(0);
  const reduceMotion = useReduceMotion();

  const urls = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const path of images) {
      const url = resolveAssetUrl(path ?? null);
      if (url && !seen.has(url)) {
        seen.add(url);
        out.push(url);
      }
    }
    return out;
  }, [images]);

  const columnTiles = useMemo(() => {
    const sparse = urls.length < SPARSE_THRESHOLD;
    return Array.from({ length: columns }, (_, c) =>
      Array.from({ length: TILES_PER_COLUMN }, (_, i) => {
        const n = c * TILES_PER_COLUMN + i;
        if (!urls.length) return null;
        if (sparse) return n % 3 === 0 ? urls[(n / 3) % urls.length]! : null;
        return urls[n % urls.length]!;
      }),
    );
  }, [columns, urls]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (Math.abs(w - width) > 1) setWidth(w);
  };

  const tileWidth = width > 0 ? (width - GAP * (columns - 1)) / columns : 0;

  return (
    <View pointerEvents="none" style={[styles.wall, style]} onLayout={handleLayout} testID="poster-wall">
      {tileWidth > 0
        ? columnTiles.map((tiles, c) => (
            <WallColumn
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed column count
              key={c}
              tiles={tiles}
              tileWidth={tileWidth}
              reverse={c % 2 === 1}
              animate={!reduceMotion}
            />
          ))
        : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wall: {
    flexDirection: "row",
    gap: GAP,
    transform: [{ rotate: "-10deg" }],
  },
  column: {
    gap: GAP,
  },
  tile: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#111116",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
});
