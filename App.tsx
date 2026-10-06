import { useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as NavigationBar from "expo-navigation-bar";

import { AppProviders } from "./src/providers/AppProviders";
import { RootNavigator } from "./src/navigation/RootNavigator";

function ImmersiveMode() {
  useEffect(() => {
    if (Platform.OS !== "android") return;

    // Edge-to-edge (SDK 54+) already draws a transparent, overlaying nav bar
    // that reveals on swipe while hidden.
    void NavigationBar.setVisibilityAsync("hidden").catch(() => {});
    NavigationBar.setStyle("light");
  }, []);

  return null;
}

export default function App() {
  return (
    <AppProviders>
      <StatusBar hidden style="light" />
      <ImmersiveMode />
      <RootNavigator />
    </AppProviders>
  );
}
