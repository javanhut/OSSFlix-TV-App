import type { PropsWithChildren } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { PosterWall } from "./PosterWall";

/** Reelscape wordmark (web navbar/auth logo). */
export function BrandWordmark({ size = 26 }: { size?: number }) {
  return (
    <Text style={[styles.wordmark, { fontSize: size, letterSpacing: -size * 0.05 }]} accessibilityRole="header">
      Reelscape
    </Text>
  );
}

/**
 * Backdrop for the sign-in flow (web `.oss-auth-stage`): an abstract poster wall
 * fading into the page with a soft blue glow. Media art needs a session, so the
 * wall is always abstract here.
 */
export function AuthStage({ children, topPadding = 24 }: PropsWithChildren<{ topPadding?: number }>) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.stage}>
      <PosterWall columns={4} style={styles.wall} />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(59,130,246,0.28)", "rgba(59,130,246,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.8, y: 0.6 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(7,7,10,0.35)", "rgba(7,7,10,0.75)", colors.background]}
        locations={[0, 0.3, 0.55]}
        style={StyleSheet.absoluteFill}
      />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingTop: insets.top + topPadding }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

export const authStyles = StyleSheet.create({
  card: {
    backgroundColor: "rgba(16,16,21,0.72)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 18,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.05)",
    borderColor: colors.borderBright,
    borderWidth: 1,
    borderRadius: 12,
    color: colors.text,
    fontFamily: fonts.body,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 16,
  },
  heading: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 28,
    letterSpacing: -0.8,
  },
  subheading: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 6,
  },
});

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: colors.background,
    overflow: "hidden",
  },
  flex: {
    flex: 1,
  },
  wall: {
    position: "absolute",
    top: "-12%",
    height: "70%",
    left: "-12%",
    right: "-25%",
    opacity: 0.55,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 22,
    paddingBottom: 32,
  },
  wordmark: {
    color: colors.accentText,
    fontFamily: fonts.display,
  },
});
