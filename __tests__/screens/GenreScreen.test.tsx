const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack }),
  useRoute: () => ({ key: "k", name: "Genre", params: { genre: "Drama" } }),
}));

import React from "react";
import { fireEvent } from "@testing-library/react-native";
import { GenreScreen } from "../../src/screens/GenreScreen";
import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/state/session";
import { renderWithQuery } from "../utils/renderWithQuery";

beforeEach(() => {
  mockNavigate.mockReset();
  mockGoBack.mockReset();
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: "http://media.local",
    token: "tok",
    profile: null,
    selectedProfile: null,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("GenreScreen", () => {
  it("renders titles from the matching category row", async () => {
    jest.spyOn(api, "getCategories").mockResolvedValue([
      {
        genre: "Drama",
        titles: [{ name: "Ripple", imagePath: "/img.jpg", pathToDir: "movies/Ripple" }],
      },
      {
        genre: "Action",
        titles: [{ name: "Bang", imagePath: "/img2.jpg", pathToDir: "movies/Bang" }],
      },
    ]);
    const { findByText } = renderWithQuery(<GenreScreen />);
    expect(await findByText("Ripple")).toBeTruthy();
  });

  it("navigates to TitleDetails when a card is pressed", async () => {
    jest.spyOn(api, "getCategories").mockResolvedValue([
      {
        genre: "Drama",
        titles: [
          {
            name: "Ripple",
            imagePath: "/img.jpg",
            pathToDir: "movies/Ripple",
          },
        ],
      },
    ]);
    const { findByText } = renderWithQuery(<GenreScreen />);
    fireEvent.press(await findByText("Ripple"));
    expect(mockNavigate).toHaveBeenCalledWith("TitleDetails", {
      dirPath: "movies/Ripple",
    });
  });

  it("shows the empty state when the genre has no titles", async () => {
    jest.spyOn(api, "getCategories").mockResolvedValue([
      {
        genre: "Comedy",
        titles: [{ name: "Laugh", imagePath: null, pathToDir: "movies/Laugh" }],
      },
    ]);
    const { findByText } = renderWithQuery(<GenreScreen />);
    expect(await findByText("No Drama titles")).toBeTruthy();
  });
});
