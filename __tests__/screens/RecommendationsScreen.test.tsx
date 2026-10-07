const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import React from "react";
import { ScrollView } from "react-native";
import { fireEvent } from "@testing-library/react-native";
import { RecommendationsScreen, groupRecommendations } from "../../src/screens/RecommendationsScreen";
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

const rec = (name: string, reason: string) => ({
  name,
  pathToDir: `movies/${name}`,
  imagePath: null,
  type: "Movie",
  score: 1,
  reason,
});

describe("RecommendationsScreen", () => {
  it("groups recommendations into 'Because you watch' rails by first genre", async () => {
    jest
      .spyOn(api, "getRecommendations")
      .mockResolvedValue([
        rec("Alpha", "Because you watch Action, Drama"),
        rec("Beta", "Because you watch Action"),
        rec("Gamma", "Because you watch Comedy"),
      ]);
    const { findByText, getByText } = renderWithQuery(<RecommendationsScreen />);
    expect(await findByText("For You")).toBeTruthy();
    expect(getByText("Because you watch Action")).toBeTruthy();
    expect(getByText("Because you watch Comedy")).toBeTruthy();
    expect(getByText("Alpha")).toBeTruthy();
    expect(getByText("Gamma")).toBeTruthy();
  });

  it("navigates to TitleDetails on press", async () => {
    jest.spyOn(api, "getRecommendations").mockResolvedValue([rec("Alpha", "Because you watch Action")]);
    const { findByText } = renderWithQuery(<RecommendationsScreen />);
    fireEvent.press(await findByText("Alpha"));
    expect(mockNavigate).toHaveBeenCalledWith("TitleDetails", { dirPath: "movies/Alpha" });
  });

  it("renders an empty state when there are no recommendations", async () => {
    jest.spyOn(api, "getRecommendations").mockResolvedValue([]);
    const { findByText } = renderWithQuery(<RecommendationsScreen />);
    expect(await findByText("No recommendations yet.")).toBeTruthy();
  });
});

describe("groupRecommendations", () => {
  it("falls back to a 'Recommended' group when the reason has no genre", () => {
    expect(groupRecommendations([rec("A", "")])).toEqual([{ title: "Recommended", items: [rec("A", "")] }]);
  });

  it("glides a focused row to the top, and the first row only as far as it needs", async () => {
    const scrollSpy = jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(() => {});
    jest
      .spyOn(api, "getRecommendations")
      .mockResolvedValue([rec("Alpha", "Because you watch Action"), rec("Gamma", "Because you watch Comedy")]);
    const { findByText, getByText, getByTestId, getByLabelText } = renderWithQuery(<RecommendationsScreen />);
    await findByText("Because you watch Comedy");
    fireEvent(getByTestId("recommendations-scroll"), "layout", {
      nativeEvent: { layout: { x: 0, y: 0, width: 900, height: 500 } },
    });
    fireEvent(getByText("Because you watch Action"), "layout", {
      nativeEvent: { layout: { x: 0, y: 300, width: 900, height: 280 } },
    });
    fireEvent(getByText("Because you watch Comedy"), "layout", {
      nativeEvent: { layout: { x: 0, y: 580, width: 900, height: 280 } },
    });

    fireEvent(getByLabelText("Gamma"), "focus");
    expect(scrollSpy).toHaveBeenCalledWith({ y: 580 - 8 - 52, animated: true });

    fireEvent(getByLabelText("Alpha"), "focus");
    expect(scrollSpy).toHaveBeenCalledWith({ y: 300 + 280 - 500 + 8, animated: true });
  });
});
