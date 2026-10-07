import { forwardRef, useState } from "react";
import {
  Pressable as RNPressable,
  type PressableProps,
  type PressableStateCallbackType,
  type StyleProp,
  StyleSheet,
  type View,
  type ViewStyle,
} from "react-native";

export type FocusPressableProps = PressableProps & {
  /** Extra style while focused by a D-pad / keyboard (TV remote). Adds to the default ring. */
  focusStyle?: StyleProp<ViewStyle>;
  // Android View props that Pressable passes through but doesn't declare: the native handle of the
  // view the D-pad goes to in that direction, overriding Android's nearest-view guess.
  nextFocusUp?: number;
  nextFocusDown?: number;
  nextFocusLeft?: number;
  nextFocusRight?: number;
};

/**
 * Drop-in `Pressable` that shows a focus ring when it has D-pad focus. Touch never
 * focuses it, so phones look unchanged; on a TV this is what shows where you are.
 */
export const Pressable = forwardRef<View, FocusPressableProps>(function FocusPressable(
  { style, focusStyle, onFocus, onBlur, ...rest },
  ref,
) {
  const [focused, setFocused] = useState(false);
  return (
    <RNPressable
      ref={ref}
      {...rest}
      onFocus={(event) => {
        setFocused(true);
        onFocus?.(event);
      }}
      onBlur={(event) => {
        setFocused(false);
        onBlur?.(event);
      }}
      style={(state: PressableStateCallbackType) => [
        typeof style === "function" ? style(state) : style,
        focused && styles.focused,
        focused && focusStyle,
      ]}
    />
  );
});

const styles = StyleSheet.create({
  focused: {
    outlineColor: "#ffffff",
    outlineWidth: 3,
    outlineOffset: 2,
    outlineStyle: "solid",
  },
});
