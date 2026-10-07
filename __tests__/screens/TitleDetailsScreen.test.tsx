import React from "react";
const mockWindow = { current: null as null | { width: number; height: number; scale: number; fontScale: number } };
jest.mock("react-native/Libraries/Utilities/useWindowDimensions", () => {
  const actual = jest.requireActual("react-native/Libraries/Utilities/useWindowDimensions");
  return {
    __esModule: true,
    default: () => mockWindow.current ?? actual.default(),
  };
});

import { Alert, ScrollView, StyleSheet } from "react-native";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { TitleDetailsScreen } from "../../src/screens/TitleDetailsScreen";
import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/state/session";
import { renderWithQuery } from "../utils/renderWithQuery";

const navigation = { navigate: jest.fn(), goBack: jest.fn(), setParams: jest.fn() } as any;
const route = {
  key: "k",
  name: "TitleDetails",
  params: { dirPath: "shows/Foo" },
} as any;

const baseDetails = {
  name: "Foo",
  description: "desc",
  genre: ["Drama"],
  type: "tv show",
  cast: ["Ada", "Lin"],
  bannerImage: "/banner.jpg",
  dirPath: "shows/Foo",
  videos: ["shows/Foo/foo_s1_ep1.mkv", "shows/Foo/foo_s1_ep2.mkv"],
  subtitles: [{ label: "EN", language: "en", src: "s.vtt", format: "vtt" }],
};

beforeEach(() => {
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
  navigation.setParams.mockReset();
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: "http://media.local",
    token: "t",
    profile: null,
    selectedProfile: null,
  });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
  // Default resolved shapes so React Query never sees an undefined return.
  // Individual tests override these when they need different behavior.
  jest.spyOn(api, "getTitleDetails").mockResolvedValue(baseDetails as any);
  jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: false });
  jest.spyOn(api, "getProgressForDir").mockResolvedValue([]);
});

afterEach(() => {
  mockWindow.current = null;
  jest.restoreAllMocks();
});

describe("TitleDetailsScreen", () => {
  it("autoplay opens the player at the resume point once, then clears the flag", async () => {
    jest
      .spyOn(api, "getProgressForDir")
      .mockResolvedValue([
        { video_src: "shows/Foo/foo_s1_ep2.mkv", dir_path: "shows/Foo", current_time: 60, duration: 1200 },
      ]);
    const autoplayRoute = { ...route, params: { dirPath: "shows/Foo", autoplay: true } };
    renderWithQuery(<TitleDetailsScreen navigation={navigation} route={autoplayRoute} />);
    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith(
        "Player",
        expect.objectContaining({ dirPath: "shows/Foo", startIndex: 1, initialTime: 60 }),
      ),
    );
    expect(navigation.setParams).toHaveBeenCalledWith({ autoplay: false });
    expect(navigation.navigate).toHaveBeenCalledTimes(1);
  });

  it("resumes the most recently watched episode, not the first in-progress one", async () => {
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([
      {
        video_src: "shows/Foo/foo_s1_ep1.mkv",
        dir_path: "shows/Foo",
        current_time: 258,
        duration: 1420,
        updated_at: "2026-10-05 20:00:00",
      },
      {
        video_src: "shows/Foo/foo_s1_ep2.mkv",
        dir_path: "shows/Foo",
        current_time: 300,
        duration: 1420,
        updated_at: "2026-10-06 21:00:00",
      },
    ]);
    const autoplayRoute = { ...route, params: { dirPath: "shows/Foo", autoplay: true } };
    renderWithQuery(<TitleDetailsScreen navigation={navigation} route={autoplayRoute} />);
    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith(
        "Player",
        expect.objectContaining({ startIndex: 1, initialTime: 300 }),
      ),
    );
  });

  it("starts the next episode when the most recent one was watched to the credits", async () => {
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([
      {
        video_src: "shows/Foo/foo_s1_ep1.mkv",
        dir_path: "shows/Foo",
        current_time: 1332,
        duration: 1420,
        updated_at: "2026-10-06 21:00:00",
      },
    ]);
    const autoplayRoute = { ...route, params: { dirPath: "shows/Foo", autoplay: true } };
    renderWithQuery(<TitleDetailsScreen navigation={navigation} route={autoplayRoute} />);
    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith(
        "Player",
        expect.objectContaining({ startIndex: 1, initialTime: 0 }),
      ),
    );
  });

  it("on a TV, sizes episode rows so four fit in the scrolling list", async () => {
    mockWindow.current = { width: 960, height: 540, scale: 2, fontScale: 1 };
    const { findAllByTestId, getByTestId } = renderWithQuery(
      <TitleDetailsScreen navigation={navigation} route={route} />,
    );
    await findAllByTestId("episode-row");
    fireEvent(getByTestId("episode-scroller"), "layout", { nativeEvent: { layout: { height: 400 } } });
    const rows = await findAllByTestId("episode-row");
    // (400 - 2 * 16 inset - 3 * 10 gap) / 4
    expect(StyleSheet.flatten(rows[0].props.style).height).toBe(84.5);
  });

  it("on a TV, glides the episode list to keep the focused episode in the second slot", async () => {
    mockWindow.current = { width: 960, height: 540, scale: 2, fontScale: 1 };
    const scrollSpy = jest.spyOn(ScrollView.prototype, "scrollTo").mockImplementation(() => {});
    const videos = [1, 2, 3, 4, 5, 6].map((n) => `shows/Foo/foo_s1_ep${n}.mkv`);
    jest.spyOn(api, "getTitleDetails").mockResolvedValue({ ...baseDetails, videos } as any);
    const { findAllByTestId, getByTestId, getByLabelText } = renderWithQuery(
      <TitleDetailsScreen navigation={navigation} route={route} />,
    );
    await findAllByTestId("episode-row");
    fireEvent(getByTestId("episode-scroller"), "layout", { nativeEvent: { layout: { height: 400 } } });
    await findAllByTestId("episode-row");
    fireEvent(getByLabelText("Play Episode 4"), "focus");
    // Row height 84.5 + 10 gap; episode 4 (index 3) lands in slot 1.
    expect(scrollSpy).toHaveBeenCalledWith({ y: 2 * 94.5, animated: true });
  });

  it("on a TV, shows the title over the banner with its own back button", async () => {
    mockWindow.current = { width: 960, height: 540, scale: 2, fontScale: 1 };
    const { findByRole, getByLabelText, getByText } = renderWithQuery(
      <TitleDetailsScreen navigation={navigation} route={route} />,
    );
    expect(await findByRole("header", { name: "Foo" })).toBeTruthy();
    expect(getByText("TV Show  ·  Drama")).toBeTruthy();
    fireEvent.press(getByLabelText("Go back"));
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });

  it("does not open the player without autoplay", async () => {
    const { findByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    await findByText("Play");
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("renders the loader while details are loading", () => {
    jest.spyOn(api, "getTitleDetails").mockReturnValue(new Promise(() => {}));
    jest.spyOn(api, "watchlistCheck").mockReturnValue(new Promise(() => {}));
    jest.spyOn(api, "getProgressForDir").mockReturnValue(new Promise(() => {}));
    const { UNSAFE_root } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    expect(UNSAFE_root).toBeTruthy();
  });

  it("renders details, cast, genres, and the Play button when no progress", async () => {
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(baseDetails as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: false });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([]);

    const { findAllByText, getByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    expect((await findAllByText("Foo")).length).toBeGreaterThanOrEqual(1);
    expect(getByText("TV Show")).toBeTruthy();
    expect(getByText("Drama")).toBeTruthy();
    expect(getByText("Cast: Ada, Lin")).toBeTruthy();
    expect(getByText("Play")).toBeTruthy();
    expect(getByText("My List")).toBeTruthy();
  });

  it("renders Resume when there is in-progress playback", async () => {
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(baseDetails as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: true });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([
      {
        video_src: "shows/Foo/foo_s1_ep2.mkv",
        dir_path: "shows/Foo",
        current_time: 60,
        duration: 1800,
      },
    ] as any);

    const { findByText, getByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    expect(await findByText("Resume")).toBeTruthy();
    expect(getByText("In My List")).toBeTruthy();
  });

  it("navigates to Player from the Play button using the resume entry index", async () => {
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(baseDetails as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: false });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([
      {
        video_src: "shows/Foo/foo_s1_ep2.mkv",
        dir_path: "shows/Foo",
        current_time: 30,
        duration: 1800,
      },
    ] as any);

    const { findByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    fireEvent.press(await findByText("Resume"));
    expect(navigation.navigate).toHaveBeenCalledWith(
      "Player",
      expect.objectContaining({
        dirPath: "shows/Foo",
        title: "Foo",
        startIndex: 1,
        initialTime: 30,
      }),
    );
  });

  it("navigates to Player with the right episode index when an episode row is tapped", async () => {
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(baseDetails as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: false });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([]);

    const { findByLabelText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    const row = await findByLabelText("Play Episode 2");
    fireEvent.press(row);
    expect(navigation.navigate).toHaveBeenCalledWith(
      "Player",
      expect.objectContaining({
        startIndex: 1,
        initialTime: 0,
      }),
    );
  });

  it("formats non-episode video filenames using the fallback formatter", async () => {
    const details = { ...baseDetails, videos: ["shows/Foo/random_clip.mp4"] };
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(details as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: false });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([]);

    const { findByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    expect(await findByText("Random Clip")).toBeTruthy();
  });

  it("shows the empty state when there are no videos", async () => {
    const details = { ...baseDetails, videos: [] };
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(details as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: false });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([]);

    const { findByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    expect(await findByText("No playable files found")).toBeTruthy();
  });

  it("renders the poster fallback when bannerImage is null", async () => {
    const details = { ...baseDetails, bannerImage: null };
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(details as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: false });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([]);

    const { findAllByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    expect((await findAllByText("Foo")).length).toBeGreaterThanOrEqual(1);
  });

  it("Add to My List triggers addToWatchlist", async () => {
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(baseDetails as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: false });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([]);
    const addSpy = jest.spyOn(api, "addToWatchlist").mockResolvedValue({ ok: true });

    const { findByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    const button = await findByText("My List");
    await act(async () => {
      fireEvent.press(button);
    });
    await waitFor(() => expect(addSpy).toHaveBeenCalledWith("shows/Foo"));
  });

  it("Remove from My List triggers removeFromWatchlist", async () => {
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(baseDetails as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: true });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([]);
    const removeSpy = jest.spyOn(api, "removeFromWatchlist").mockResolvedValue({ ok: true });

    const { findByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    const button = await findByText("In My List");
    await act(async () => {
      fireEvent.press(button);
    });
    await waitFor(() => expect(removeSpy).toHaveBeenCalledWith("shows/Foo"));
  });

  it("alerts when the watchlist mutation throws", async () => {
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(baseDetails as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: false });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([]);
    jest.spyOn(api, "addToWatchlist").mockRejectedValue(new Error("boom"));

    const { findByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    const button = await findByText("My List");
    await act(async () => {
      fireEvent.press(button);
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Unable to update My List", "boom");
    });
  });

  it("alerts with a fallback message when the mutation throws a non-Error", async () => {
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(baseDetails as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: false });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([]);
    jest.spyOn(api, "addToWatchlist").mockRejectedValue("weird");

    const { findByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    const button = await findByText("My List");
    await act(async () => {
      fireEvent.press(button);
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Unable to update My List", "Request failed.");
    });
  });

  it("returns null when details are absent (after loading)", async () => {
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(undefined as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: false });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([]);
    const { toJSON } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    await waitFor(() => expect(toJSON()).toBeNull());
  });

  it("genre chip navigates to the Genre screen when tapped", async () => {
    const { findByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    const chip = await findByText("Drama");
    fireEvent.press(chip);
    expect(navigation.navigate).toHaveBeenCalledWith("Genre", {
      genre: "Drama",
    });
  });

  it("disables Play (no playTarget) when there are no videos", async () => {
    const details = { ...baseDetails, videos: [] };
    jest.spyOn(api, "getTitleDetails").mockResolvedValue(details as any);
    jest.spyOn(api, "watchlistCheck").mockResolvedValue({ inList: false });
    jest.spyOn(api, "getProgressForDir").mockResolvedValue([]);

    const { findByText } = renderWithQuery(<TitleDetailsScreen navigation={navigation} route={route} />);
    const playButton = await findByText("Play");
    fireEvent.press(playButton);
    expect(navigation.navigate).not.toHaveBeenCalled();
  });
});
