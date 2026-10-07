import { useDeferredValue, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { api } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { EmptyState } from "../components/EmptyState";
import { TitleCard } from "../components/TitleCard";
import { TV_GLIDE_SCROLL_PROPS, useFocusGlide } from "../hooks/useFocusGlide";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import type { TitleSummary } from "../types/api";

const CARD_WIDTH = 160;
const ROW_GAP = 18;

export function SearchScreen() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const results = useQuery({
    queryKey: ["search", deferredQuery],
    queryFn: () => api.search(deferredQuery),
    enabled: deferredQuery.length > 0,
  });
  const { listRef, glideToRow } = useFocusGlide<TitleSummary>({ stride: CARD_WIDTH * 1.5 + ROW_GAP, inset: ROW_GAP });

  return (
    <View style={styles.screen}>
      <AppHeader title="Search" subtitle="Find movies and shows across the connected Reelscape server." />
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search titles"
        placeholderTextColor={colors.textDim}
        style={styles.input}
      />
      {results.isFetching && <ActivityIndicator color={colors.primary} style={styles.spinner} />}
      <FlatList
        ref={listRef}
        data={results.data?.titles || []}
        keyExtractor={(item) => item.pathToDir}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
        {...TV_GLIDE_SCROLL_PROPS}
        ListEmptyComponent={
          deferredQuery.length > 0 ? (
            <EmptyState title="No matching titles" subtitle="Try a broader title, genre, or keyword." />
          ) : (
            <EmptyState
              title="Start typing to search"
              subtitle="Search queries hit the Reelscape media catalog directly."
            />
          )
        }
        renderItem={({ item, index }) => (
          <TitleCard
            item={item}
            width={CARD_WIDTH}
            onPress={() => navigation.navigate("TitleDetails", { dirPath: item.pathToDir })}
            onFocus={() => glideToRow(Math.floor(index / 2))}
          />
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
    padding: 18,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    marginBottom: 10,
  },
  spinner: {
    marginTop: 16,
  },
  list: {
    paddingTop: ROW_GAP,
    paddingBottom: 32,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: ROW_GAP,
  },
});
