import { type BottomTabBarButtonProps, createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSessionStore } from "../state/session";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { ExploreScreen } from "../screens/ExploreScreen";
import { GenreScreen } from "../screens/GenreScreen";
import { HomeScreen } from "../screens/HomeScreen";
import { DownloadsScreen } from "../screens/DownloadsScreen";
import { LibraryScreen } from "../screens/LibraryScreen";
import { PlayerScreen } from "../screens/PlayerScreen";
import { ProfileLookupScreen } from "../screens/ProfileLookupScreen";
import { ProfileScreen } from "../screens/ProfileScreen";
import { ProfileSelectScreen } from "../screens/ProfileSelectScreen";
import { RecommendationsScreen } from "../screens/RecommendationsScreen";
import { RegisterScreen } from "../screens/RegisterScreen";
import { ServerConnectScreen } from "../screens/ServerConnectScreen";
import { SignInScreen } from "../screens/SignInScreen";
import { SwitchProfileScreen } from "../screens/SwitchProfileScreen";
import { TitleDetailsScreen } from "../screens/TitleDetailsScreen";
import { SearchScreen } from "../screens/SearchScreen";
import { WatchlistScreen } from "../screens/WatchlistScreen";
import { Pressable } from "../components/FocusPressable";
import { SidebarOverlay, type SidebarItem } from "../components/SidebarOverlay";

export type RootStackParamList = {
  ServerConnect: undefined;
  ProfileLookup: undefined;
  ProfileSelect: {
    profiles: import("../types/api").PublicProfile[];
    source: "email" | "unclaimed";
  };
  SignIn: undefined;
  Register: undefined;
  MainTabs: undefined;
  /** autoplay: open the player as soon as the title has loaded (hero "Play"). */
  TitleDetails: { dirPath: string; autoplay?: boolean };
  Genre: { genre: string };
  Library: { type: string; title: string };
  Watchlist: undefined;
  Recommendations: undefined;
  SwitchProfile: undefined;
  Player: {
    dirPath: string;
    title: string;
    videos: string[];
    startIndex: number;
    initialTime: number;
    subtitles?: {
      label: string;
      language: string;
      src: string;
      format: string;
    }[];
    /** When true, `videos` holds local file:// URIs and no network is used. */
    offline?: boolean;
    /** Offline metadata parallel to `videos` (duration, timings, local subtitles). */
    offlineMeta?: {
      id: string;
      duration?: number;
      timings?: import("../types/api").EpisodeTiming | null;
      subtitles?: { label: string; language: string; uri: string }[];
    }[];
  };
};

export type MainTabParamList = {
  Home: undefined;
  Search: undefined;
  Explore: undefined;
  Downloads: undefined;
  Profile: undefined;
};

// Tab buttons with a visible D-pad focus state (TV remote).
function TabButton({
  href: _href,
  pressOpacity: _pressOpacity,
  hoverEffect: _hoverEffect,
  ref: _ref,
  ...rest
}: BottomTabBarButtonProps) {
  return <Pressable {...rest} focusStyle={tabStyles.focused} />;
}

const tabStyles = StyleSheet.create({
  focused: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
  },
});

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const extraBottom = 28;
  const iconSize = isLandscape ? 24 : 26;
  const railWidth = 56;

  const tabBarStyle = isLandscape
    ? {
        backgroundColor: colors.glassStrong,
        borderRightColor: colors.border,
        borderRightWidth: 1,
        borderTopWidth: 0,
        paddingTop: insets.top + 14,
        paddingBottom: insets.bottom + 14,
        paddingStart: 0,
        paddingEnd: 0,
        paddingLeft: 0,
        paddingHorizontal: 0,
        width: railWidth,
        minWidth: 0,
        maxWidth: railWidth,
      }
    : {
        backgroundColor: colors.glassStrong,
        borderTopColor: colors.border,
        paddingTop: 14,
        paddingBottom: insets.bottom + extraBottom,
        paddingHorizontal: 18,
        height: 70 + insets.bottom + extraBottom,
      };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarPosition: isLandscape ? "left" : "bottom",
        tabBarVariant: "uikit",
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: colors.textDim,
        tabBarActiveBackgroundColor: "transparent",
        tabBarInactiveBackgroundColor: "transparent",
        tabBarShowLabel: !isLandscape,
        tabBarStyle,
        tabBarItemStyle: isLandscape
          ? {
              paddingVertical: 10,
              height: 56,
              width: railWidth,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "transparent",
            }
          : { paddingVertical: 4 },
        tabBarLabelStyle: { fontSize: 12, fontFamily: fonts.bodySemiBold, marginTop: 6 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color }) => <Feather name="home" size={iconSize} color={color} />,
        }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{
          tabBarIcon: ({ color }) => <Feather name="search" size={iconSize} color={color} />,
        }}
      />
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          tabBarIcon: ({ color }) => <Feather name="compass" size={iconSize} color={color} />,
        }}
      />
      <Tab.Screen
        name="Downloads"
        component={DownloadsScreen}
        options={{
          tabBarIcon: ({ color }) => <Feather name="download" size={iconSize} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => <Feather name="user" size={iconSize} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function MainTabsWithSidebar() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // Same order as the web navbar.
  const items: SidebarItem[] = [
    {
      icon: "film",
      label: "Movies",
      onPress: () => navigation.navigate("Library", { type: "Movie", title: "Movies" }),
    },
    {
      icon: "monitor",
      label: "TV Shows",
      onPress: () => navigation.navigate("Library", { type: "tv show", title: "TV Shows" }),
    },
    {
      icon: "play-circle",
      label: "Anime",
      onPress: () => navigation.navigate("Genre", { genre: "Anime" }),
    },
    {
      icon: "bookmark",
      label: "My List",
      onPress: () => navigation.navigate("Watchlist"),
    },
    {
      icon: "star",
      label: "Recommendations",
      onPress: () => navigation.navigate("Recommendations"),
    },
  ];

  return (
    <View style={{ flex: 1 }}>
      <MainTabs />
      <SidebarOverlay items={items} enabled={!isLandscape} />
    </View>
  );
}

function HeaderFade() {
  return (
    <LinearGradient
      colors={["rgba(7,7,10,0.85)", "rgba(7,7,10,0.35)", "rgba(7,7,10,0)"]}
      locations={[0, 0.7, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}

// Screens with a full-bleed banner/hero draw under a see-through header (web navbar at scroll top).
const overlayHeader = {
  title: "",
  headerTransparent: true,
  headerBackground: () => <HeaderFade />,
} as const;

export function RootNavigator() {
  const serverUrl = useSessionStore((state) => state.serverUrl);
  const token = useSessionStore((state) => state.token);
  const profile = useSessionStore((state) => state.profile);

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.displayBold },
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      {!serverUrl ? (
        <Stack.Screen name="ServerConnect" component={ServerConnectScreen} options={{ title: "Connect to Server" }} />
      ) : !token || !profile ? (
        <>
          <Stack.Screen name="ProfileLookup" component={ProfileLookupScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ProfileSelect" component={ProfileSelectScreen} options={{ headerShown: false }} />
          <Stack.Screen name="SignIn" component={SignInScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Register" component={RegisterScreen} options={{ title: "Create Profile" }} />
        </>
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabsWithSidebar} options={{ headerShown: false }} />
          <Stack.Screen name="TitleDetails" component={TitleDetailsScreen} options={overlayHeader} />
          <Stack.Screen name="Genre" component={GenreScreen} options={overlayHeader} />
          <Stack.Screen name="Library" component={LibraryScreen} options={overlayHeader} />
          <Stack.Screen name="Watchlist" component={WatchlistScreen} options={overlayHeader} />
          <Stack.Screen name="Recommendations" component={RecommendationsScreen} options={overlayHeader} />
          <Stack.Screen name="SwitchProfile" component={SwitchProfileScreen} options={{ title: "Switch Profile" }} />
          <Stack.Screen
            name="Player"
            component={PlayerScreen}
            options={{
              headerShown: false,
              contentStyle: { backgroundColor: "#000" },
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
