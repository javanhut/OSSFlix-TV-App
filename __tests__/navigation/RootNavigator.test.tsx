/**
 * RootNavigator picks one of three stacks depending on session state. We mock
 * the screen modules so we don't drag a heavy render tree (Video player, etc.)
 * into the test, then assert which screen the navigator renders.
 */

jest.mock("../../src/screens/ServerConnectScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    ServerConnectScreen: () => React.createElement(Text, null, "screen:ServerConnect"),
  };
});

jest.mock("../../src/screens/ProfileLookupScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    ProfileLookupScreen: () => React.createElement(Text, null, "screen:ProfileLookup"),
  };
});

jest.mock("../../src/screens/SignInScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    SignInScreen: () => React.createElement(Text, null, "screen:SignIn"),
  };
});

jest.mock("../../src/screens/RegisterScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    RegisterScreen: () => React.createElement(Text, null, "screen:Register"),
  };
});

jest.mock("../../src/screens/HomeScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { HomeScreen: () => React.createElement(Text, null, "screen:Home") };
});

jest.mock("../../src/screens/LibraryScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    LibraryScreen: () => React.createElement(Text, null, "screen:Library"),
  };
});

jest.mock("../../src/screens/SearchScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    SearchScreen: () => React.createElement(Text, null, "screen:Search"),
  };
});

jest.mock("../../src/screens/WatchlistScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    WatchlistScreen: () => React.createElement(Text, null, "screen:Watchlist"),
  };
});

jest.mock("../../src/screens/TitleDetailsScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    TitleDetailsScreen: () => React.createElement(Text, null, "screen:TitleDetails"),
  };
});

jest.mock("../../src/screens/PlayerScreen", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return {
    PlayerScreen: () => React.createElement(Text, null, "screen:Player"),
  };
});

import React from "react";
import { render } from "@testing-library/react-native";
import { NavigationContainer } from "@react-navigation/native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "../../src/navigation/RootNavigator";
import { useSessionStore } from "../../src/state/session";

function renderNav() {
  return render(
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 320, height: 640 },
        insets: { top: 0, bottom: 0, left: 0, right: 0 },
      }}
    >
      <NavigationContainer>
        <RootNavigator />
      </NavigationContainer>
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  useSessionStore.setState({
    bootstrapped: true,
    serverUrl: null,
    token: null,
    profile: null,
    selectedProfile: null,
  });
});

describe("RootNavigator", () => {
  it("shows the ServerConnect screen when no server URL is set", () => {
    const { getByText } = renderNav();
    expect(getByText("screen:ServerConnect")).toBeTruthy();
  });

  it("shows the ProfileLookup stack when server is set but no token", () => {
    useSessionStore.setState({ serverUrl: "http://media.local" });
    const { getByText } = renderNav();
    expect(getByText("screen:ProfileLookup")).toBeTruthy();
  });

  it("shows the main tabs when fully authenticated (defaults to Home)", () => {
    useSessionStore.setState({
      serverUrl: "http://media.local",
      token: "t",
      profile: { id: 1, name: "Ada" } as any,
    });
    const { getByText } = renderNav();
    expect(getByText("screen:Home")).toBeTruthy();
  });
});
