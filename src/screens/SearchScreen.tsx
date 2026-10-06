import { useDeferredValue, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, TextInput, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { api } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { EmptyState } from "../components/EmptyState";
import { TitleCard } from "../components/TitleCard";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";

export function SearchScreen() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim());
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const results = useQuery({
    queryKey: ["search", deferredQuery],
    queryFn: () => api.search(deferredQuery),
    enabled: deferredQuery.length > 0,
  });

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
        data={results.data?.titles || []}
        keyExtractor={(item) => item.pathToDir}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.list}
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
        renderItem={({ item }) => (
          <TitleCard
            item={item}
            width={160}
            onPress={() => navigation.navigate("TitleDetails", { dirPath: item.pathToDir })}
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
    paddingTop: 18,
    paddingBottom: 32,
  },
  row: {
    justifyContent: "space-between",
    marginBottom: 18,
  },
});
