import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "./FocusPressable";
import { Feather } from "@expo/vector-icons";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export function AppHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
}: {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.copy}>
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} style={styles.action}>
          <Feather name="chevron-left" size={14} color={colors.text} />
          <Text style={styles.actionLabel}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 22,
  },
  copy: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -1,
    flexShrink: 1,
  },
  subtitle: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 8,
  },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.borderBright,
    backgroundColor: colors.glass,
  },
  actionLabel: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
});
