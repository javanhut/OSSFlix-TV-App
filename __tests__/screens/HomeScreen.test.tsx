const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const mockWindow = { current: null as null | { width: number; height: number; scale: number; fontScale: number } };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => {
  const actual = jest.requireActual("react-native/Libraries/Utilities/useWindowDimensions");
  return { __esModule: true, default: () => mockWindow.current ?? actual.default() };
});

import React from "react";
import { StyleSheet } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { HomeScreen } from "../../src/screens/HomeScreen";
import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/state/session";
import { renderWithQuery } from "../utils/renderWithQuery";

beforeEach(() => {
  mockNavigate.mockReset();
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: "http://media.local",
    token: "tok",
    profile: { id: 1, name: "Ada" } as any,
    selectedProfile: null,
  });
});

afterEach(() => {
  mockWindow.current = null;
  jest.restoreAllMocks();
});

describe("HomeScreen", () => {
  it("shows a loader while queries are pending", () => {
    jest.spyOn(api, "getCategories").mockReturnValue(new Promise(() => {}));
    jest.spyOn(api, "getContinueWatching").mockReturnValue(new Promise(() => {}));
    jest.spyOn(api, "getWatchlist").mockReturnValue(new Promise(() => {}));
    const { UNSAFE_root } = renderWithQuery(<HomeScreen />);
    expect(UNSAFE_root).toBeTruthy();
  });

  it("renders the brand and rails when data is loaded", async () => {
    jest.spyOn(api, "getCategories").mockResolvedValue([
      {
        genre: "Action",
        titles: [{ name: "Bond", imagePath: null, pathToDir: "movies/Bond" }],
      },
    ]);
    jest.spyOn(api, "getContinueWatching").mockResolvedValue({
      genre: "Continue",
      titles: [{ name: "Resume", imagePath: null, pathToDir: "movies/Resume" }],
    });
    jest.spyOn(api, "getWatchlist").mockResolvedValue({
      genre: "Watchlist",
      titles: [{ name: "Saved", imagePath: null, pathToDir: "movies/Saved" }],
    });
    const { findByText, getByText, getAllByText } = renderWithQuery(<HomeScreen />);
    expect(await findByText("Reelscape")).toBeTruthy();
    expect(getByText("Continue Watching")).toBeTruthy();
    // Once as a browse link, once as the rail heading.
    expect(getAllByText("My List")).toHaveLength(2);
    expect(getByText("Action")).toBeTruthy();
  });

  it("hero More Info opens details and Play opens details with autoplay", async () => {
    jest.spyOn(api, "getCategories").mockResolvedValue([
      {
        genre: "Newly Added",
        titles: [
          {
            name: "Hero",
            imagePath: "/api/assets/hero.jpg",
            pathToDir: "movies/Hero",
          },
        ],
      },
    ]);
    jest.spyOn(api, "getContinueWatching").mockResolvedValue({ genre: "Continue", titles: [] });
    jest.spyOn(api, "getWatchlist").mockResolvedValue({ genre: "Watchlist", titles: [] });
    jest.spyOn(api, "getTitleDetails").mockReturnValue(new Promise(() => {}));

    const { findByText, getByText } = renderWithQuery(<HomeScreen />);
    fireEvent.press(await findByText("More Info"));
    expect(mockNavigate).toHaveBeenCalledWith("TitleDetails", {
      dirPath: "movies/Hero",
    });
    fireEvent.press(getByText("Play"));
    expect(mockNavigate).toHaveBeenCalledWith("TitleDetails", {
      dirPath: "movies/Hero",
      autoplay: true,
    });
  });

  it.each([
    ["Movies", "Library", { type: "Movie", title: "Movies" }],
    ["TV Shows", "Library", { type: "tv show", title: "TV Shows" }],
    ["Anime", "Genre", { genre: "Anime" }],
    ["For You", "Recommendations", undefined],
  ])("browse link %s opens %s", async (label, screen, params) => {
    jest.spyOn(api, "getCategories").mockResolvedValue([]);
    jest.spyOn(api, "getContinueWatching").mockResolvedValue({ genre: "Continue", titles: [] });
    jest.spyOn(api, "getWatchlist").mockResolvedValue({ genre: "Watchlist", titles: [] });
    const { findByText } = renderWithQuery(<HomeScreen />);
    fireEvent.press(await findByText(label));
    if (params) expect(mockNavigate).toHaveBeenCalledWith(screen, params);
    else expect(mockNavigate).toHaveBeenCalledWith(screen);
  });

  it("browse link My List opens the watchlist", async () => {
    jest.spyOn(api, "getCategories").mockResolvedValue([]);
    jest.spyOn(api, "getContinueWatching").mockResolvedValue({ genre: "Continue", titles: [] });
    jest.spyOn(api, "getWatchlist").mockResolvedValue({ genre: "Watchlist", titles: [] });
    const { findByText } = renderWithQuery(<HomeScreen />);
    fireEvent.press(await findByText("My List"));
    expect(mockNavigate).toHaveBeenCalledWith("Watchlist");
  });

  it("on a TV, puts the section links in a top nav bar like the website", async () => {
    mockWindow.current = { width: 960, height: 540, scale: 2, fontScale: 1 };
    jest.spyOn(api, "getCategories").mockResolvedValue([]);
    jest.spyOn(api, "getContinueWatching").mockResolvedValue({ genre: "Continue", titles: [] });
    jest.spyOn(api, "getWatchlist").mockResolvedValue({ genre: "Watchlist", titles: [] });
    const { findByText, getByText } = renderWithQuery(<HomeScreen />);
    expect(await findByText("Reelscape")).toBeTruthy();
    fireEvent.press(getByText("TV Shows"));
    expect(mockNavigate).toHaveBeenCalledWith("Library", { type: "tv show", title: "TV Shows" });
  });

  it("on a TV, keeps the header pinned and turns it solid once the page scrolls", async () => {
    mockWindow.current = { width: 960, height: 540, scale: 2, fontScale: 1 };
    jest.spyOn(api, "getCategories").mockResolvedValue([]);
    jest.spyOn(api, "getContinueWatching").mockResolvedValue({ genre: "Continue", titles: [] });
    jest.spyOn(api, "getWatchlist").mockResolvedValue({ genre: "Watchlist", titles: [] });
    const { findByTestId, getByTestId } = renderWithQuery(<HomeScreen />);
    const background = () => StyleSheet.flatten(getByTestId("tv-header").props.style).backgroundColor;
    await findByTestId("tv-header");
    expect(background()).toBeUndefined();
    fireEvent.scroll(getByTestId("home-scroll"), { nativeEvent: { contentOffset: { x: 0, y: 300 } } });
    expect(background()).toBe("rgba(6,12,30,0.92)");
    fireEvent.scroll(getByTestId("home-scroll"), { nativeEvent: { contentOffset: { x: 0, y: 0 } } });
    expect(background()).toBeUndefined();
  });

  it("renders the empty state when there are no categories", async () => {
    jest.spyOn(api, "getCategories").mockResolvedValue([]);
    jest.spyOn(api, "getContinueWatching").mockResolvedValue({ genre: "Continue", titles: [] });
    jest.spyOn(api, "getWatchlist").mockResolvedValue({ genre: "Watchlist", titles: [] });
    const { findByText } = renderWithQuery(<HomeScreen />);
    expect(await findByText("No library data yet")).toBeTruthy();
  });
});
