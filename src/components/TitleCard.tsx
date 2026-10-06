import { Image, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Pressable } from "./FocusPressable";
import { LinearGradient } from "expo-linear-gradient";

import { resolveAssetUrl } from "../api/client";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { TitleSummary } from "../types/api";

/** Poster card with the title overlaid on a bottom scrim (web `.oss-card`). */
export function TitleCard({
  item,
  onPress,
  width = 140,
  style,
}: {
  item: TitleSummary;
  onPress: () => void;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const imageUrl = resolveAssetUrl(item.imagePath);
  const progress = typeof item.progressPct === "number" ? Math.max(0, Math.min(100, item.progressPct)) : 0;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      style={({ pressed }) => [styles.card, { width }, style, pressed && styles.cardPressed]}
      focusStyle={styles.cardFocused}
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
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    aspectRatio: 2 / 3,
    marginRight: 12,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  cardFocused: {
    transform: [{ scale: 1.06 }],
    borderColor: "rgba(255,255,255,0.9)",
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
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
