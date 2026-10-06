/**
 * AppProviders bootstraps the session from secure storage, then renders its
 * children inside QueryClientProvider, NavigationContainer, SafeAreaProvider.
 * We mock SecureStore so we can drive both the success and failure bootstrap
 * branches.
 */

const mockGetItemAsync = jest.fn<Promise<string | null>, [string]>(async () => null);
const mockSetItemAsync = jest.fn<Promise<void>, [string, string]>(async () => {});
const mockDeleteItemAsync = jest.fn<Promise<void>, [string]>(async () => {});

jest.mock("expo-secure-store", () => ({
  getItemAsync: (key: string) => mockGetItemAsync(key),
  setItemAsync: (key: string, value: string) => mockSetItemAsync(key, value),
  deleteItemAsync: (key: string) => mockDeleteItemAsync(key),
}));

jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.Fragment, null, children),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  };
});

import React from "react";
import { Text } from "react-native";
import { act, render, waitFor } from "@testing-library/react-native";
import { AppProviders } from "../../src/providers/AppProviders";
import { useSessionStore } from "../../src/state/session";

beforeEach(() => {
  mockGetItemAsync.mockReset();
  mockSetItemAsync.mockReset();
  mockDeleteItemAsync.mockReset();
  mockGetItemAsync.mockResolvedValue(null);
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: null,
    token: null,
    profile: null,
    selectedProfile: null,
  });
});

describe("AppProviders", () => {
  it("renders the loading shell before the session is bootstrapped", () => {
    let resolve!: () => void;
    mockGetItemAsync.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = () => r(null);
        }),
    );
    const { queryByText } = render(
      <AppProviders>
        <Text>child</Text>
      </AppProviders>,
    );
    expect(queryByText("child")).toBeNull();
    act(() => resolve());
  });

  it("hydrates the session and renders children when bootstrap succeeds", async () => {
    mockGetItemAsync.mockImplementation(async (key: string) => {
      if (key === "ossflix_mobile_server_url") return "http://media.local";
      if (key === "ossflix_mobile_token") return "tok";
      return null;
    });
    const { findByText } = render(
      <AppProviders>
        <Text>child</Text>
      </AppProviders>,
    );
    expect(await findByText("child")).toBeTruthy();
    expect(useSessionStore.getState().serverUrl).toBe("http://media.local");
    expect(useSessionStore.getState().bootstrapped).toBe(true);
  });

  it("still bootstraps with empty state when SecureStore throws", async () => {
    mockGetItemAsync.mockRejectedValue(new Error("secure store unavailable"));
    const { findByText } = render(
      <AppProviders>
        <Text>child</Text>
      </AppProviders>,
    );
    expect(await findByText("child")).toBeTruthy();
    expect(useSessionStore.getState().serverUrl).toBeNull();
    expect(useSessionStore.getState().bootstrapped).toBe(true);
  });

  it("persists session changes after bootstrap", async () => {
    mockGetItemAsync.mockResolvedValue(null);
    render(
      <AppProviders>
        <Text>child</Text>
      </AppProviders>,
    );
    await waitFor(() => expect(useSessionStore.getState().bootstrapped).toBe(true));

    await act(async () => {
      useSessionStore.getState().setServerUrl("http://new.local");
      // Allow effect-driven save to flush.
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(mockSetItemAsync).toHaveBeenCalledWith("ossflix_mobile_server_url", "http://new.local");
    });
  });
});
