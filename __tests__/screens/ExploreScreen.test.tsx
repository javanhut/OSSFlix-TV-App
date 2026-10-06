const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import React from "react";
import { fireEvent } from "@testing-library/react-native";
import { ExploreScreen } from "../../src/screens/ExploreScreen";
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

describe("ExploreScreen", () => {
  it("shows the loader while categories are pending", () => {
    jest.spyOn(api, "getCategories").mockReturnValue(new Promise(() => {}) as any);
    const { toJSON } = renderWithQuery(<ExploreScreen />);
    expect(toJSON()).toBeTruthy();
  });

  it("renders the category tiles when data is loaded", async () => {
    jest.spyOn(api, "getCategories").mockResolvedValue([
      {
        genre: "Action",
        titles: [{ pathToDir: "a", name: "A", imagePath: null, type: "Movie" }],
      },
      { genre: "Empty", titles: [] },
      {
        genre: "Comedy",
        titles: [{ pathToDir: "c", name: "C", imagePath: null, type: "Movie" }],
      },
    ] as any);
    const { findByText, queryByText } = renderWithQuery(<ExploreScreen />);
    expect(await findByText("Action")).toBeTruthy();
    expect(await findByText("Comedy")).toBeTruthy();
    expect(queryByText("Empty")).toBeNull();
  });

  it("navigates to the Genre route when a tile is pressed", async () => {
    jest.spyOn(api, "getCategories").mockResolvedValue([
      {
        genre: "Action",
        titles: [{ pathToDir: "a", name: "A", imagePath: null, type: "Movie" }],
      },
    ] as any);
    const { findByText } = renderWithQuery(<ExploreScreen />);
    fireEvent.press(await findByText("Action"));
    expect(mockNavigate).toHaveBeenCalledWith("Genre", { genre: "Action" });
  });

  it("renders the empty state when no categories are returned", async () => {
    jest.spyOn(api, "getCategories").mockResolvedValue([] as any);
    const { findByText } = renderWithQuery(<ExploreScreen />);
    expect(await findByText("No categories yet")).toBeTruthy();
  });
});
