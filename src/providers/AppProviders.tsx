import { type PropsWithChildren, useEffect } from "react";
import { ActivityIndicator, AppState, StyleSheet, View } from "react-native";
import { focusManager, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer, DarkTheme, useNavigationContainerRef } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";

import { bootstrapDownloads } from "../downloads/downloadManager";
import { buildSessionSnapshot, useSessionStore } from "../state/session";
import { loadSessionSnapshot, saveSessionSnapshot } from "../storage/sessionStorage";
import { colors } from "../theme/colors";
import { fontAssets } from "../theme/typography";

const queryClient = new QueryClient();

// Data on screen older than this is refetched when you navigate to (or back to) a screen.
export const REFRESH_AFTER_MS = 30_000;

/**
 * Tab screens stay mounted for the whole session, so without this their queries would only ever
 * load once and new titles added on the server would never show up. Refetches the mounted queries
 * that have gone stale; skipped while the player is up so it doesn't compete with the video.
 */
export function refreshVisibleQueries(client: QueryClient, routeName: string | undefined) {
  if (routeName === "Player") return;
  const cutoff = Date.now() - REFRESH_AFTER_MS;
  void client.refetchQueries({
    type: "active",
    predicate: (query) => query.state.dataUpdatedAt < cutoff,
  });
}

function BootstrappedApp({ children }: PropsWithChildren) {
  const bootstrapped = useSessionStore((state) => state.bootstrapped);
  const hydrate = useSessionStore((state) => state.hydrate);
  const serverUrl = useSessionStore((state) => state.serverUrl);
  const token = useSessionStore((state) => state.token);
  const profile = useSessionStore((state) => state.profile);
  const selectedProfile = useSessionStore((state) => state.selectedProfile);
  // A font load failure falls back to the system font rather than blocking the app.
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  useEffect(() => {
    loadSessionSnapshot()
      .then(hydrate)
      .catch(() =>
        hydrate({
          serverUrl: null,
          token: null,
          profile: null,
          selectedProfile: null,
        }),
      );
    void bootstrapDownloads().catch(() => {});
  }, [hydrate]);

  // React Native has no window focus: tell React Query when the app comes back to the foreground
  // (e.g. from the Fire TV home screen), so whatever is on screen refetches.
  useEffect(() => {
    focusManager.setEventListener((setFocused) => {
      const subscription = AppState.addEventListener("change", (state) => setFocused(state === "active"));
      return () => subscription.remove();
    });
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: buildSessionSnapshot reads from the store; these deps trigger the save when any field changes.
  useEffect(() => {
    if (!bootstrapped) return;
    void saveSessionSnapshot(buildSessionSnapshot());
  }, [bootstrapped, serverUrl, token, profile, selectedProfile]);

  if (!bootstrapped || (!fontsLoaded && !fontError)) {
    return (
      <View style={styles.loadingShell}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
}

export function AppProviders({ children }: PropsWithChildren) {
  const navigationRef = useNavigationContainerRef<Record<string, object | undefined>>();
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer
          ref={navigationRef}
          theme={theme}
          onStateChange={() => refreshVisibleQueries(queryClient, navigationRef.getCurrentRoute()?.name)}
        >
          <BootstrappedApp>{children}</BootstrappedApp>
        </NavigationContainer>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.surfaceElevated,
    border: colors.border,
    primary: colors.primary,
    text: colors.text,
  },
};

const styles = StyleSheet.create({
  loadingShell: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
});
