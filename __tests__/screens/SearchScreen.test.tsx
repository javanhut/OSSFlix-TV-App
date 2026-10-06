const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import React from "react";
import { act, fireEvent } from "@testing-library/react-native";
import { SearchScreen } from "../../src/screens/SearchScreen";
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

describe("SearchScreen", () => {
  it("shows the idle empty-state before any query is typed", () => {
    const searchSpy = jest.spyOn(api, "search");
    const { getByText } = renderWithQuery(<SearchScreen />);
    expect(getByText("Start typing to search")).toBeTruthy();
    expect(searchSpy).not.toHaveBeenCalled();
  });

  it("runs a search and renders matching titles", async () => {
    jest.spyOn(api, "search").mockResolvedValue({
      titles: [{ name: "Match", imagePath: null, pathToDir: "movies/Match" }],
      genres: [],
    });
    const { getByPlaceholderText, findAllByText } = renderWithQuery(<SearchScreen />);
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText("Search titles"), "foo");
    });
    const matches = await findAllByText("Match");
    expect(matches.length).toBeGreaterThan(0);
  });

  it("shows the no-results empty state when search returns nothing", async () => {
    jest.spyOn(api, "search").mockResolvedValue({ titles: [], genres: [] });
    const { getByPlaceholderText, findByText } = renderWithQuery(<SearchScreen />);
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText("Search titles"), "nothing");
    });
    expect(await findByText("No matching titles")).toBeTruthy();
  });

  it("navigates to TitleDetails when a result is pressed", async () => {
    jest.spyOn(api, "search").mockResolvedValue({
      titles: [{ name: "Pick", imagePath: null, pathToDir: "movies/Pick" }],
      genres: [],
    });
    const { getByPlaceholderText, findAllByText } = renderWithQuery(<SearchScreen />);
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText("Search titles"), "foo");
    });
    const matches = await findAllByText("Pick");
    fireEvent.press(matches[0]);
    expect(mockNavigate).toHaveBeenCalledWith("TitleDetails", {
      dirPath: "movies/Pick",
    });
  });
});
