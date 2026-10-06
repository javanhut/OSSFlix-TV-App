import { useState } from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { Pressable } from "./FocusPressable";
import { Feather } from "@expo/vector-icons";

import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

type Props = Omit<TextInputProps, "secureTextEntry"> & {
  /** Override the default placeholder text color so screens can theme if needed. */
  placeholderTextColor?: string;
};

export function PasswordField({ style, placeholderTextColor, ...textProps }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      <TextInput
        {...textProps}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        placeholderTextColor={placeholderTextColor ?? colors.textDim}
        style={styles.input}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
        hitSlop={10}
      >
        <Feather name={visible ? "eye-off" : "eye"} size={18} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "relative",
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderBright,
    justifyContent: "center",
  },
  input: {
    color: colors.text,
    fontFamily: fonts.body,
    paddingHorizontal: 16,
    paddingVertical: 13,
    paddingRight: 48,
    fontSize: 16,
  },
  toggle: {
    position: "absolute",
    right: 6,
    top: 0,
    bottom: 0,
    width: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  togglePressed: {
    opacity: 0.6,
  },
});
