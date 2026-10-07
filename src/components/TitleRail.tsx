import { useCallback, useRef, useState } from "react";
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { TitleSummary } from "../types/api";
import { TITLE_CARD_GAP, TITLE_CARD_WIDTH, TitleCard } from "./TitleCard";

const FADE_WIDTH = 28;
// Room around the cards for the focused card's scale-up and ring, which the list would clip.
const FOCUS_GUTTER = 16;
const EDGE_EPSILON = 1;
const keyExtractor = (item: TitleSummary) => item.pathToDir;
// Focus follows at the second slot, so the cards either side of it are always already on screen
// and Android never has to jump the row; the row glides here instead.
const FOCUS_SLOT = 1;
const CARD_STRIDE = TITLE_CARD_WIDTH + TITLE_CARD_GAP;

export function TitleRail({
  title,
  items,
  onSelect,
  onRowFocus,
}: {
  title: string;
  items: TitleSummary[];
  onSelect: (item: TitleSummary) => void;
  /** A card in this row got D-pad focus (the page scrolls the row into place). */
  onRowFocus?: () => void;
}) {
  const listRef = useRef<FlatList<TitleSummary>>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const onRowFocusRef = useRef(onRowFocus);
  onRowFocusRef.current = onRowFocus;
  // Scroll position lives in a ref: only the two fade flags are state, so a scrolling row
  // re-renders when a fade appears or disappears, not on every scroll frame.
  const scrollXRef = useRef(0);
  const contentWidthRef = useRef(0);
  const layoutWidthRef = useRef(0);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  // Like the web row hover: the heading turns blue while the remote is in this row.
  const [hasFocus, setHasFocus] = useState(false);

  const updateFades = useCallback(() => {
    const x = scrollXRef.current;
    const max = contentWidthRef.current - layoutWidthRef.current;
    setShowLeftFade(x > EDGE_EPSILON);
    setAtEnd(max <= EDGE_EPSILON || x >= max - EDGE_EPSILON);
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollXRef.current = event.nativeEvent.contentOffset.x;
      updateFades();
    },
    [updateFades],
  );

  const handleContentSizeChange = useCallback(
    (w: number) => {
      contentWidthRef.current = w;
      updateFades();
    },
    [updateFades],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      layoutWidthRef.current = event.nativeEvent.layout.width;
      updateFades();
    },
    [updateFades],
  );

  const handleCardFocus = useCallback((item: TitleSummary) => {
    setHasFocus(true);
    onRowFocusRef.current?.();
    const index = itemsRef.current.indexOf(item);
    if (index >= 0) {
      listRef.current?.scrollToOffset({ offset: Math.max(0, (index - FOCUS_SLOT) * CARD_STRIDE), animated: true });
    }
  }, []);
  const handleCardBlur = useCallback(() => setHasFocus(false), []);
  // Stable so the list doesn't re-render every card when the heading highlight changes.
  const renderItem = useCallback(
    ({ item }: { item: TitleSummary }) => (
      <TitleCard item={item} onPress={onSelect} onFocus={handleCardFocus} onBlur={handleCardBlur} />
    ),
    [onSelect, handleCardFocus, handleCardBlur],
  );

  if (!items.length) return null;

  const showRightFade = !atEnd;

  return (
    <View style={styles.section}>
      <Text style={[styles.heading, hasFocus && styles.headingFocused]} accessibilityRole="header">
        {title}
      </Text>
      <View style={styles.railWrapper} onLayout={handleLayout}>
        <FlatList
          ref={listRef}
          horizontal
          data={items}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onContentSizeChange={handleContentSizeChange}
        />
        {showLeftFade ? (
          <LinearGradient
            pointerEvents="none"
            colors={[colors.background, "transparent"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fade, styles.fadeLeft]}
          />
        ) : null}
        {showRightFade ? (
          <LinearGradient
            pointerEvents="none"
            colors={["transparent", colors.background]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.fade, styles.fadeRight]}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 28,
  },
  heading: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 21,
    letterSpacing: -0.4,
    marginBottom: 6,
  },
  headingFocused: {
    color: colors.accentText,
  },
  railWrapper: {
    position: "relative",
    margin: -FOCUS_GUTTER,
  },
  listContent: {
    padding: FOCUS_GUTTER,
  },
  fade: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: FADE_WIDTH,
  },
  fadeLeft: {
    left: 0,
  },
  fadeRight: {
    right: 0,
  },
});
