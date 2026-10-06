const mockNavigate = jest.fn();
const mockRoute = { params: { type: "Movie", title: "Movies" } };
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
  useRoute: () => mockRoute,
}));

import React from "react";
import { fireEvent } from "@testing-library/react-native";
import { LibraryScreen } from "../../src/screens/LibraryScreen";
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

describe("LibraryScreen", () => {
  it("renders the loading indicator while loading", () => {
    jest.spyOn(api, "getLibrary").mockReturnValue(new Promise(() => {}));
    const { UNSAFE_root } = renderWithQuery(<LibraryScreen />);
    expect(UNSAFE_root).toBeTruthy();
  });

  it("renders the library title and titles when loaded", async () => {
    jest.spyOn(api, "getLibrary").mockResolvedValue([
      { name: "A", imagePath: null, pathToDir: "movies/A" },
      { name: "B", imagePath: null, pathToDir: "movies/B" },
    ]);
    const { findByText, getAllByText } = renderWithQuery(<LibraryScreen />);
    expect(await findByText("Movies")).toBeTruthy();
    expect(getAllByText("A").length).toBeGreaterThan(0);
    expect(getAllByText("B").length).toBeGreaterThan(0);
  });

  it("shows the empty state when no titles match", async () => {
    jest.spyOn(api, "getLibrary").mockResolvedValue([]);
    const { findByText } = renderWithQuery(<LibraryScreen />);
    expect(await findByText("No movies found.")).toBeTruthy();
  });

  it("navigates to TitleDetails when a card is pressed", async () => {
    jest.spyOn(api, "getLibrary").mockResolvedValue([{ name: "Pick", imagePath: null, pathToDir: "movies/Pick" }]);
    const { findAllByText } = renderWithQuery(<LibraryScreen />);
    const matches = await findAllByText("Pick");
    fireEvent.press(matches[0]);
    expect(mockNavigate).toHaveBeenCalledWith("TitleDetails", {
      dirPath: "movies/Pick",
    });
  });
});
