import type { PropsWithChildren } from "react";
import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { PosterWall } from "./PosterWall";

// Screens pad their content by this much; the hero cancels it to run edge to edge.
export const SCREEN_GUTTER = 18;
// Room for the transparent stack header (back button) the hero sits under.
const HEADER_SPACE = 52;

/** Full-bleed page header over a drifting poster wall (web `PageHero`). */
export function PageHero({
  title,
  subtitle,
  images,
  children,
}: PropsWithChildren<{
  title: string;
  subtitle?: string;
  images?: (string | null | undefined)[];
}>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.hero, { paddingTop: insets.top + HEADER_SPACE + 24 }]}>
      <PosterWall images={images} columns={4} style={styles.wall} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(59,130,246,0.24)", "rgba(59,130,246,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.7, y: 0.7 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={[colors.background, "rgba(7,7,10,0.85)", "rgba(7,7,10,0.2)", "rgba(7,7,10,0)"]}
        locations={[0, 0.3, 0.65, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(7,7,10,0.5)", "rgba(7,7,10,0.15)", "rgba(7,7,10,0.6)", colors.background]}
        locations={[0, 0.3, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.copy}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    minHeight: 260,
    justifyContent: "flex-end",
    marginHorizontal: -SCREEN_GUTTER,
    marginTop: -SCREEN_GUTTER,
    marginBottom: 20,
    paddingHorizontal: SCREEN_GUTTER + 4,
    paddingBottom: 22,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  wall: {
    position: "absolute",
    top: "-45%",
    bottom: "-45%",
    left: "12%",
    right: "-10%",
    opacity: 0.6,
  },
  copy: {
    maxWidth: 640,
  },
  title: {
    color: "#ffffff",
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.6,
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
});
