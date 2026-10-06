import { useRef, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";
import { Pressable } from "./FocusPressable";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";

export interface SidebarItem {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
}

const PANEL_WIDTH = 280;
const EDGE_ZONE_WIDTH = 22;
const OPEN_THRESHOLD = PANEL_WIDTH * 0.4;

export function SidebarOverlay({ items, enabled = true }: { items: SidebarItem[]; enabled?: boolean }) {
  const insets = useSafeAreaInsets();
  const [mounted, setMounted] = useState(false);
  const translateX = useRef(new Animated.Value(-PANEL_WIDTH)).current;

  const animateOpen = () => {
    setMounted(true);
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
      speed: 18,
    }).start();
  };

  const animateClose = () => {
    Animated.spring(translateX, {
      toValue: -PANEL_WIDTH,
      useNativeDriver: true,
      bounciness: 0,
      speed: 18,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  };

  const edgeResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => enabled,
      onMoveShouldSetPanResponder: (_, gs) => enabled && gs.dx > 6 && Math.abs(gs.dy) < Math.abs(gs.dx),
      onPanResponderGrant: () => {
        setMounted(true);
      },
      onPanResponderMove: (_, gs) => {
        const next = Math.max(-PANEL_WIDTH, Math.min(0, gs.dx - PANEL_WIDTH));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > OPEN_THRESHOLD) animateOpen();
        else animateClose();
      },
      onPanResponderTerminate: () => animateClose(),
    }),
  ).current;

  const panelResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gs) => gs.dx < -6 && Math.abs(gs.dy) < Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        const next = Math.max(-PANEL_WIDTH, Math.min(0, gs.dx));
        translateX.setValue(next);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -OPEN_THRESHOLD) animateClose();
        else animateOpen();
      },
    }),
  ).current;

  if (!enabled) return null;

  const backdropOpacity = translateX.interpolate({
    inputRange: [-PANEL_WIDTH, 0],
    outputRange: [0, 0.55],
    extrapolate: "clamp",
  });

  return (
    <>
      <View
        style={[styles.edge, { width: EDGE_ZONE_WIDTH, top: insets.top }]}
        {...edgeResponder.panHandlers}
        pointerEvents={mounted ? "none" : "auto"}
      />

      {mounted ? (
        <>
          <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
            <Pressable style={StyleSheet.absoluteFill} onPress={animateClose} />
          </Animated.View>

          <Animated.View
            style={[
              styles.panel,
              {
                width: PANEL_WIDTH,
                paddingTop: insets.top + 24,
                paddingBottom: insets.bottom + 24,
                transform: [{ translateX }],
              },
            ]}
            {...panelResponder.panHandlers}
          >
            <Text style={styles.brand}>Reelscape</Text>
            {items.map((item) => (
              <Pressable
                key={item.label}
                onPress={() => {
                  animateClose();
                  setTimeout(() => item.onPress(), 180);
                }}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
              >
                <Feather name={item.icon} size={22} color={colors.text} />
                <Text style={styles.itemLabel}>{item.label}</Text>
              </Pressable>
            ))}
          </Animated.View>
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  edge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    zIndex: 50,
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
    zIndex: 60,
  },
  panel: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.glassStrong,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingHorizontal: 20,
    zIndex: 70,
  },
  brand: {
    color: colors.accentText,
    fontFamily: fonts.display,
    fontSize: 24,
    letterSpacing: -1,
    marginBottom: 24,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  itemPressed: {
    backgroundColor: colors.surfaceAccent,
  },
  itemLabel: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 16,
  },
});
