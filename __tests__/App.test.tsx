/**
 * App is a thin wrapper. We mock the heavy children so the test focuses on
 * the Android-only ImmersiveMode side effects.
 */

const mockSetVisibility = jest.fn<Promise<void>, [string]>(async () => {});
const mockSetStyle = jest.fn<void, [string]>();

jest.mock("expo-navigation-bar", () => ({
  setVisibilityAsync: (arg: string) => mockSetVisibility(arg),
  setStyle: (arg: string) => mockSetStyle(arg),
}));

jest.mock("expo-status-bar", () => ({
  StatusBar: () => null,
}));

jest.mock("../src/providers/AppProviders", () => {
  const React = require("react");
  return {
    AppProviders: ({ children }: any) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock("../src/navigation/RootNavigator", () => {
  const React = require("react");
  const { Text } = require("react-native");
  return { RootNavigator: () => React.createElement(Text, null, "root-nav") };
});

import React from "react";
import { Platform } from "react-native";
import { render, waitFor } from "@testing-library/react-native";
import App from "../App";

afterEach(() => {
  jest.clearAllMocks();
});

describe("App", () => {
  it("renders the navigator", () => {
    const { getByText } = render(<App />);
    expect(getByText("root-nav")).toBeTruthy();
  });

  it("configures the immersive nav bar on Android", async () => {
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      value: "android",
    });
    render(<App />);
    await waitFor(() => {
      expect(mockSetVisibility).toHaveBeenCalledWith("hidden");
      expect(mockSetStyle).toHaveBeenCalledWith("light");
    });
  });

  it("does NOT configure the navigation bar on iOS", () => {
    Object.defineProperty(Platform, "OS", { configurable: true, value: "ios" });
    render(<App />);
    expect(mockSetVisibility).not.toHaveBeenCalled();
    expect(mockSetStyle).not.toHaveBeenCalled();
  });
});
