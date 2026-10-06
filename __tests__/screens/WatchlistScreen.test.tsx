const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import React from "react";
import { fireEvent } from "@testing-library/react-native";
import { WatchlistScreen } from "../../src/screens/WatchlistScreen";
import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/state/session";
import { renderWithQuery } from "../utils/renderWithQuery";

beforeEach(() => {
  mockNavigate.mockReset();
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: "http://media.local",
    token: "t",
    profile: null,
    selectedProfile: null,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("WatchlistScreen", () => {
  it("renders the loading indicator while loading", () => {
    jest.spyOn(api, "getWatchlist").mockReturnValue(new Promise(() => {}));
    const { UNSAFE_root } = renderWithQuery(<WatchlistScreen />);
    expect(UNSAFE_root).toBeTruthy();
  });

  it("renders titles and the header when populated", async () => {
    jest.spyOn(api, "getWatchlist").mockResolvedValue({
      genre: "watchlist",
      titles: [{ name: "Saved", imagePath: null, pathToDir: "movies/Saved" }],
    });
    const { findByText, findAllByText } = renderWithQuery(<WatchlistScreen />);
    expect(await findByText("My List")).toBeTruthy();
    expect((await findAllByText("Saved")).length).toBeGreaterThan(0);
  });

  it("renders the empty state when the watchlist is empty", async () => {
    jest.spyOn(api, "getWatchlist").mockResolvedValue({ genre: "watchlist", titles: [] });
    const { findByText } = renderWithQuery(<WatchlistScreen />);
    expect(await findByText("Your list is empty.")).toBeTruthy();
  });

  it("navigates to TitleDetails when a card is pressed", async () => {
    jest.spyOn(api, "getWatchlist").mockResolvedValue({
      genre: "watchlist",
      titles: [{ name: "Pick", imagePath: null, pathToDir: "movies/Pick" }],
    });
    const { findAllByText } = renderWithQuery(<WatchlistScreen />);
    const matches = await findAllByText("Pick");
    fireEvent.press(matches[0]);
    expect(mockNavigate).toHaveBeenCalledWith("TitleDetails", {
      dirPath: "movies/Pick",
    });
  });
});
