import { memo, useRef, useState } from "react";
import { Animated, Easing, Image, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Pressable } from "./FocusPressable";
import { LinearGradient } from "expo-linear-gradient";

import { resolveAssetUrl } from "../api/client";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { TitleSummary } from "../types/api";

export const TITLE_CARD_WIDTH = 140;
export const TITLE_CARD_GAP = 14;
const FOCUS_SCALE = 1.06;
const FOCUS_ANIM_MS = 140;

/**
 * Poster card with the title overlaid on a bottom scrim (web `.oss-card`). Focus eases the card
 * up (native-driven, so it stays smooth while the row scrolls) and adds the blue ring.
 */
export const TitleCard = memo(function TitleCard({
  item,
  onPress,
  width = TITLE_CARD_WIDTH,
  style,
  onFocus,
  onBlur,
}: {
  item: TitleSummary;
  onPress: (item: TitleSummary) => void;
  width?: number;
  style?: StyleProp<ViewStyle>;
  onFocus?: (item: TitleSummary) => void;
  onBlur?: () => void;
}) {
  const imageUrl = resolveAssetUrl(item.imagePath);
  const progress = typeof item.progressPct === "number" ? Math.max(0, Math.min(100, item.progressPct)) : 0;
  const [focused, setFocused] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) =>
    Animated.timing(scale, {
      toValue,
      duration: FOCUS_ANIM_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

  return (
    <Pressable
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      style={[styles.slot, { width }, style]}
      focusStyle={styles.noOutline}
      onFocus={() => {
        setFocused(true);
        animateTo(FOCUS_SCALE);
        onFocus?.(item);
      }}
      onBlur={() => {
        setFocused(false);
        animateTo(1);
        onBlur?.();
      }}
    >
      {({ pressed }) => (
        <Animated.View
          style={[
            styles.card,
            focused && styles.cardFocused,
            pressed && styles.cardPressed,
            { transform: [{ scale }] },
          ]}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
          ) : (
            <View style={[styles.image, styles.placeholder]} />
          )}
          <LinearGradient pointerEvents="none" colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.9)"]} style={styles.scrim} />
          <Text style={styles.title} numberOfLines={2}>
            {item.name}
          </Text>
          {progress > 0 ? (
            <View style={styles.progressTrack} pointerEvents="none" testID="title-card-progress">
              <View style={[styles.progressFill, { width: `${progress}%` }]} testID="title-card-progress-fill" />
            </View>
          ) : null}
        </Animated.View>
      )}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  slot: {
    aspectRatio: 2 / 3,
    marginRight: TITLE_CARD_GAP,
  },
  // The ring lives on the animated card (so it scales with it), not as the Pressable's outline.
  noOutline: {
    outlineWidth: 0,
  },
  card: {
    flex: 1,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    boxShadow: "0 6px 18px rgba(0,0,0,0.5)",
  },
  // The web card's hover lift, plus the TV blue ring so focus reads from across the room.
  cardFocused: {
    borderColor: "#60a5fa",
    boxShadow: "0 0 0 2px #60a5fa, 0 0 24px 4px rgba(59,130,246,0.45), 0 18px 40px rgba(0,0,0,0.7)",
  },
  cardPressed: {
    opacity: 0.85,
  },
  image: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  placeholder: {
    backgroundColor: colors.surfaceElevated,
  },
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "45%",
  },
  title: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 11,
    color: "#ffffff",
    fontFamily: fonts.displaySemiBold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: -0.1,
  },
  progressTrack: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressFill: {
    height: "100%",
    backgroundColor: colors.primary,
  },
});
