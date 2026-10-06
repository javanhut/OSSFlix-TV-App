import { type PropsWithChildren, useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer, DarkTheme } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";

import { bootstrapDownloads } from "../downloads/downloadManager";
import { buildSessionSnapshot, useSessionStore } from "../state/session";
import { loadSessionSnapshot, saveSessionSnapshot } from "../storage/sessionStorage";
import { colors } from "../theme/colors";
import { fontAssets } from "../theme/typography";

const queryClient = new QueryClient();

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
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <NavigationContainer theme={theme}>
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
