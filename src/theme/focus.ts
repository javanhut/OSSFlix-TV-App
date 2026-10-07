import type { ViewStyle } from "react-native";

/** D-pad focus as a crisp blue ring plus a tight glow (replaces FocusPressable's white outline). */
export const focusGlow: ViewStyle = {
  outlineWidth: 0,
  boxShadow: "0 0 0 2px #60a5fa, 0 0 22px 5px rgba(59,130,246,0.6)",
};
