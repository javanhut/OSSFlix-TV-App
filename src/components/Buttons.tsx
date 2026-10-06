import { type ComponentProps, useRef } from "react";
import { type StyleProp, StyleSheet, Text, type View, type ViewStyle } from "react-native";
import { Pressable } from "./FocusPressable";
import { Feather } from "@expo/vector-icons";

import { colors } from "../theme/colors";
import { useTVPreferredFocus } from "../utils/tv";
import { fonts } from "../theme/typography";

type FeatherName = ComponentProps<typeof Feather>["name"];

type ButtonProps = {
  label: string;
  onPress: () => void;
  icon?: FeatherName;
  disabled?: boolean;
  large?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  /** Take initial focus when the screen opens on a TV. */
  preferredFocus?: boolean;
};

/** White, high-contrast play/resume action (web `.oss-btn-play`). */
export function PlayButton({
  label,
  onPress,
  icon = "play",
  disabled,
  large,
  style,
  testID,
  preferredFocus,
}: ButtonProps) {
  const ref = useRef<View>(null);
  useTVPreferredFocus(ref, preferredFocus);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      ref={ref}
      style={({ pressed }) => [
        styles.base,
        large && styles.large,
        styles.play,
        pressed && styles.playPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Feather name={icon} size={large ? 18 : 16} color={colors.playText} />
      <Text style={[styles.label, large && styles.labelLarge, { color: colors.playText }]}>{label}</Text>
    </Pressable>
  );
}

/** Translucent glass action (web `.oss-btn-secondary`). */
export function GlassButton({ label, onPress, icon, disabled, large, style, testID, preferredFocus }: ButtonProps) {
  const ref = useRef<View>(null);
  useTVPreferredFocus(ref, preferredFocus);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      ref={ref}
      style={({ pressed }) => [
        styles.base,
        large && styles.large,
        styles.glass,
        pressed && styles.glassPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? <Feather name={icon} size={large ? 18 : 16} color={colors.text} /> : null}
      <Text style={[styles.label, large && styles.labelLarge]}>{label}</Text>
    </Pressable>
  );
}

/** Solid accent action (web `.oss-btn-primary`). */
export function PrimaryButton({ label, onPress, icon, disabled, large, style, testID, preferredFocus }: ButtonProps) {
  const ref = useRef<View>(null);
  useTVPreferredFocus(ref, preferredFocus);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      ref={ref}
      style={({ pressed }) => [
        styles.base,
        large && styles.large,
        styles.primary,
        pressed && styles.primaryPressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon ? <Feather name={icon} size={large ? 18 : 16} color={colors.primaryText} /> : null}
      <Text style={[styles.label, large && styles.labelLarge, { color: colors.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  large: {
    paddingHorizontal: 26,
    paddingVertical: 14,
  },
  play: {
    backgroundColor: colors.play,
  },
  playPressed: {
    backgroundColor: colors.playPressed,
  },
  glass: {
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  glassPressed: {
    backgroundColor: "rgba(255,255,255,0.24)",
  },
  primary: {
    backgroundColor: colors.primary,
  },
  primaryPressed: {
    backgroundColor: colors.primaryPressed,
  },
  disabled: {
    opacity: 0.45,
  },
  label: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
  },
  labelLarge: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
  },
});
