import { StyleSheet, Text, View } from "react-native";
import { colors } from "../theme/colors";

export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 36,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    textAlign: "center",
  },
});
