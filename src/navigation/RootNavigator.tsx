import { type BottomTabBarButtonProps, createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSessionStore } from "../state/session";
import { colors } from "../theme/colors";
import { focusGlow } from "../theme/focus";
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
  style,
  children,
  ...rest
}: BottomTabBarButtonProps) {
  const selected = rest["aria-selected"] === true;
  return (
    <Pressable {...rest} style={[style, tabStyles.button]} focusStyle={[focusGlow, tabStyles.focused]}>
      {children}
      {/* Marks the current section, like the web navbar's underline. */}
      {selected ? <View style={tabStyles.selectedBar} /> : null}
    </Pressable>
  );
}

const tabStyles = StyleSheet.create({
  // The sidebar variant lays the button out as a left-aligned row (built for icon + label);
  // with icons only, center the icon instead.
  button: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 0,
  },
  focused: {
    backgroundColor: "rgba(59,130,246,0.18)",
    borderRadius: 12,
  },
  selectedBar: {
    position: "absolute",
    left: -6,
    top: "28%",
    bottom: "28%",
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
});

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function MainTabs() {
  const insets = useSafeAreaInsets();
  const iconSize = 24;
  const railWidth = 56;
  const tabFocusInset = 6;
  const railBorder = 1;

  // TV layout: a slim icon rail on the left, reached with D-pad left.
  const tabBarStyle = {
    backgroundColor: "rgba(6,12,30,0.94)",
    borderRightColor: colors.border,
    borderRightWidth: railBorder,
    borderTopWidth: 0,
    paddingTop: insets.top + 14,
    paddingBottom: insets.bottom + 14,
    // The navigator pads the sidebar with paddingStart/End, which beat paddingHorizontal, so zero
    // them directly; otherwise the items overflow the rail's right edge.
    paddingStart: insets.left,
    paddingEnd: 0,
    width: railWidth + insets.left,
    minWidth: 0,
    maxWidth: railWidth + insets.left,
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarButton: (props) => <TabButton {...props} />,
        tabBarPosition: "left",
        tabBarVariant: "uikit",
        tabBarActiveTintColor: "#ffffff",
        tabBarInactiveTintColor: colors.textDim,
        tabBarActiveBackgroundColor: "transparent",
        tabBarInactiveBackgroundColor: "transparent",
        tabBarShowLabel: false,
        tabBarStyle,
        // Narrower than the rail so the focus outline isn't clipped by its edges.
        tabBarItemStyle: {
          paddingVertical: 10,
          height: 56,
          width: railWidth - railBorder - 2 * tabFocusInset,
          marginHorizontal: tabFocusInset,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "transparent",
        },
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
          <Stack.Screen name="MainTabs" component={MainTabs} options={{ headerShown: false }} />
          {/* Draws its own back button over the banner. */}
          <Stack.Screen name="TitleDetails" component={TitleDetailsScreen} options={{ headerShown: false }} />
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
