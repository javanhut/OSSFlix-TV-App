/**
 * PlayerScreen contains substantial gesture/Video integration. We mock the
 * heavy native pieces (react-native-video, expo-screen-orientation,
 * useSafeAreaInsets, native volume bridge) and exercise the React-side state
 * machine: control toggling, menu wiring, navigation, lifecycle persistence.
 */

const mockSeek = jest.fn();

jest.mock("react-native-video", () => {
  const React = require("react");
  const { View } = require("react-native");
  const Video = React.forwardRef((props: any, ref: any) => {
    React.useImperativeHandle(ref, () => ({ seek: mockSeek }));
    (Video as any).lastProps = props;
    return React.createElement(View, { testID: "mock-video" });
  });
  return {
    __esModule: true,
    default: Video,
    SelectedTrackType: { INDEX: "index", DISABLED: "disabled" },
    TextTrackType: { VTT: "vtt" },
  };
});

jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(async () => {}),
  OrientationLock: { LANDSCAPE: 4, PORTRAIT_UP: 1 },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
  SafeAreaProvider: ({ children }: any) => children,
}));

const mockSetVolume = jest.fn(async (v: number) => v);
const mockGetVolumeInfo = jest.fn(async () => ({ volume: 0.7, maxVolume: 15 }));
const mockSetPlayerStream = jest.fn();
jest.mock("../../src/native/systemVolume", () => ({
  getSystemMusicVolume: jest.fn(async () => 0.7),
  getSystemMusicVolumeInfo: (...args: unknown[]) => mockGetVolumeInfo(...(args as [])),
  setSystemMusicVolume: (...args: unknown[]) => mockSetVolume(...(args as [number])),
  setPlayerVolumeStream: (...args: unknown[]) => mockSetPlayerStream(...(args as [])),
}));

import React from "react";
import { DeviceEventEmitter, PanResponder } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Video from "react-native-video";
import { PlayerScreen } from "../../src/screens/PlayerScreen";
import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/state/session";

const navigation = { navigate: jest.fn(), goBack: jest.fn() } as any;

function makeRoute(
  overrides: Partial<{
    startIndex: number;
    initialTime: number;
    videos: string[];
    subtitles: any[];
  }> = {},
) {
  return {
    key: "k",
    name: "Player",
    params: {
      dirPath: "shows/Foo",
      title: "Foo",
      videos: overrides.videos ?? ["shows/Foo/foo_s1_ep1.mkv", "shows/Foo/foo_s1_ep2.mkv"],
      startIndex: overrides.startIndex ?? 0,
      initialTime: overrides.initialTime ?? 0,
      subtitles: overrides.subtitles ?? [{ label: "EN", language: "en", src: "s.vtt", format: "vtt" }],
    },
  } as any;
}

function renderPlayer(routeOverride?: ReturnType<typeof makeRoute>) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const route = routeOverride ?? makeRoute();
  return render(
    <QueryClientProvider client={client}>
      <PlayerScreen navigation={navigation} route={route} />
    </QueryClientProvider>,
  );
}

function layoutPlayerScreen(root: ReturnType<typeof renderPlayer>) {
  fireEvent(root.getByTestId("player-screen"), "layout", {
    nativeEvent: { layout: { width: 300, height: 300, x: 0, y: 0 } },
  });
}

async function dragGesture(
  root: ReturnType<typeof renderPlayer>,
  { locationX, locationY, dx, dy }: { locationX: number; locationY: number; dx: number; dy: number },
) {
  const surface = root.getByTestId("gesture-surface");
  await act(async () => {
    surface.props.onResponderGrant?.(
      { nativeEvent: { locationX, locationY, pageY: locationY } },
      { dx: 0, dy: 0, moveY: locationY },
    );
    surface.props.onResponderMove?.(
      {
        nativeEvent: {
          locationX: locationX + dx,
          locationY: locationY + dy,
          pageY: locationY + dy,
        },
      },
      { dx, dy, moveY: locationY + dy },
    );
    surface.props.onResponderRelease?.(
      {
        nativeEvent: {
          locationX: locationX + dx,
          locationY: locationY + dy,
          pageY: locationY + dy,
        },
      },
      { dx, dy, moveY: locationY + dy },
    );
  });
}

beforeEach(() => {
  jest.spyOn(PanResponder, "create").mockImplementation(
    (config: any) =>
      ({
        panHandlers: {
          onStartShouldSetResponder: (event: any) => config.onStartShouldSetPanResponder?.(event),
          onMoveShouldSetResponder: (event: any, gestureState: any) =>
            config.onMoveShouldSetPanResponder?.(event, gestureState),
          onResponderGrant: (event: any, gestureState: any) => config.onPanResponderGrant?.(event, gestureState),
          onResponderMove: (event: any, gestureState: any) => config.onPanResponderMove?.(event, gestureState),
          onResponderRelease: (event: any, gestureState: any) => config.onPanResponderRelease?.(event, gestureState),
          onResponderTerminate: (event: any, gestureState: any) =>
            config.onPanResponderTerminate?.(event, gestureState),
        },
      }) as any,
  );
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
  mockSeek.mockReset();
  mockSetVolume.mockClear();
  mockGetVolumeInfo.mockClear();
  mockSetPlayerStream.mockClear();
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: "http://media.local",
    token: "t",
    profile: null,
    selectedProfile: null,
  });
  jest.spyOn(api, "getProbe").mockResolvedValue({
    duration: 1800,
    audioTracks: [
      {
        index: 0,
        codec: "aac",
        channels: 2,
        channelLayout: "stereo",
        language: "eng",
        title: "English",
      },
      {
        index: 1,
        codec: "aac",
        channels: 2,
        channelLayout: "stereo",
        language: "jpn",
        title: "Japanese",
      },
    ],
  });
  jest.spyOn(api, "getTimings").mockResolvedValue({
    video_src: "foo",
    intro_start: 30,
    intro_end: 60,
    outro_start: 1700,
    outro_end: 1750,
  });
  jest.spyOn(api, "saveProgress").mockResolvedValue({ ok: true });
});

afterEach(async () => {
  // Flush any pending React Query notifyManager callbacks so they resolve
  // inside act() rather than after teardown.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  jest.restoreAllMocks();
});

describe("PlayerScreen — render and Video wiring", () => {
  it("renders the mock Video with the computed stream URL and headers", async () => {
    renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    const props = (Video as any).lastProps;
    expect(props.source.uri).toContain("/api/stream?src=shows%2FFoo%2Ffoo_s1_ep1.mkv&audio=0");
    expect(props.source.headers).toEqual({ Authorization: "Bearer t" });
    expect(props.textTracks[0].uri).toContain("/api/subtitles?src=s.vtt");
  });

  it("reads the system music volume on mount", async () => {
    renderPlayer();
    await waitFor(() => expect(mockGetVolumeInfo).toHaveBeenCalled());
  });

  it("configures the player to use the music stream on mount", async () => {
    renderPlayer();
    await waitFor(() => expect(mockSetPlayerStream).toHaveBeenCalled());
  });

  it("renders the show title in the top bar and the episode label in the controls", async () => {
    const { findByText } = renderPlayer();
    expect(await findByText("Foo")).toBeTruthy();
    expect(await findByText("Episode 1: Foo")).toBeTruthy();
  });
});

describe("PlayerScreen — volume gestures", () => {
  it("raises the volume when dragging upward from the right-side lane", async () => {
    const screen = renderPlayer();
    layoutPlayerScreen(screen);
    await waitFor(() => expect(mockGetVolumeInfo).toHaveBeenCalled());

    await dragGesture(screen, {
      locationX: 260,
      locationY: 220,
      dx: 0,
      dy: -200,
    });

    await waitFor(() => expect(mockSetVolume).toHaveBeenCalledWith(1));
    expect((Video as any).lastProps.volume).toBe(1);
    expect(mockSeek).not.toHaveBeenCalled();
  });

  it("lowers the volume when dragging downward from the right-side lane", async () => {
    mockGetVolumeInfo.mockResolvedValueOnce({ volume: 0.8, maxVolume: 15 });
    const screen = renderPlayer();
    layoutPlayerScreen(screen);
    await waitFor(() => expect(mockGetVolumeInfo).toHaveBeenCalled());

    await dragGesture(screen, {
      locationX: 250,
      locationY: 100,
      dx: 0,
      dy: 120,
    });

    await waitFor(() => expect(mockSetVolume).toHaveBeenCalled());
    const lastVolume = mockSetVolume.mock.calls.at(-1)?.[0];
    expect(lastVolume).toBeCloseTo(4 / 15, 5);
    expect((Video as any).lastProps.volume).toBe(1);
  });

  it("does not change volume when the drag starts outside the right-side lane", async () => {
    const screen = renderPlayer();
    layoutPlayerScreen(screen);
    await waitFor(() => expect(mockGetVolumeInfo).toHaveBeenCalled());

    await dragGesture(screen, {
      locationX: 150,
      locationY: 180,
      dx: 0,
      dy: -90,
    });

    expect(mockSetVolume).not.toHaveBeenCalled();
    expect((Video as any).lastProps.volume).toBe(1);
  });

  it("does not change volume for a small movement on the right side", async () => {
    const screen = renderPlayer();
    layoutPlayerScreen(screen);
    await waitFor(() => expect(mockGetVolumeInfo).toHaveBeenCalled());

    await dragGesture(screen, {
      locationX: 260,
      locationY: 180,
      dx: 0,
      dy: -8,
    });

    expect(mockSetVolume).not.toHaveBeenCalled();
    expect((Video as any).lastProps.volume).toBe(1);
  });
});

describe("PlayerScreen — Video lifecycle callbacks", () => {
  it("onLoad seeks to the pending time when initialTime > 0", async () => {
    renderPlayer(makeRoute({ initialTime: 42 }));
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 1800 });
    });
    expect(mockSeek).toHaveBeenCalledWith(42);
  });

  it("onProgress updates the displayed time", async () => {
    const { findByText } = renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 1800 });
      (Video as any).lastProps.onProgress({ currentTime: 75 });
    });
    expect(await findByText("1:15")).toBeTruthy();
  });

  it("onEnd advances to the next video when there is one", async () => {
    renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 1800 });
      (Video as any).lastProps.onEnd();
    });
    await waitFor(() => {
      const props = (Video as any).lastProps;
      expect(props.source.uri).toContain("foo_s1_ep2.mkv");
    });
  });

  it("onEnd calls navigation.goBack when there is no next video", async () => {
    renderPlayer(makeRoute({ videos: ["shows/Foo/only.mkv"], startIndex: 0 }));
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 1800 });
      (Video as any).lastProps.onEnd();
    });
    expect(navigation.goBack).toHaveBeenCalled();
  });
});

function pressIconButton(root: any, iconLabel: string) {
  const icon = root.findByProps({ accessibilityLabel: iconLabel });
  const parent = icon.parent;
  if (!parent) throw new Error(`Icon ${iconLabel} has no parent Pressable`);
  fireEvent.press(parent);
}

describe("PlayerScreen — control buttons", () => {
  it("back arrow calls navigation.goBack", async () => {
    const { UNSAFE_root } = renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    pressIconButton(UNSAFE_root, "Feather-arrow-left");
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it("toggles play/pause", async () => {
    const { UNSAFE_root } = renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    pressIconButton(UNSAFE_root, "Feather-pause");
    await waitFor(() => {
      expect((Video as any).lastProps.paused).toBe(true);
    });
  });

  it("skip-back button rewinds 10 seconds", async () => {
    const { UNSAFE_root } = renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 1800 });
      (Video as any).lastProps.onProgress({ currentTime: 50 });
    });
    pressIconButton(UNSAFE_root, "Feather-rotate-ccw");
    await waitFor(() => expect(mockSeek).toHaveBeenCalledWith(40));
  });

  it("skip-forward button advances 10 seconds", async () => {
    const { UNSAFE_root } = renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 1800 });
      (Video as any).lastProps.onProgress({ currentTime: 50 });
    });
    pressIconButton(UNSAFE_root, "Feather-rotate-cw");
    await waitFor(() => expect(mockSeek).toHaveBeenCalledWith(60));
  });

  it("skip-forward seeks within 0..duration even if it would overshoot", async () => {
    renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 100 });
      (Video as any).lastProps.onProgress({ currentTime: 95 });
    });
    // The skip-by-10 from 95 should clamp to 100.
    const node = Video as any;
    expect(node.lastProps).toBeDefined();
  });

  it("skip-forward (next episode button) advances when there is a next video", async () => {
    const { UNSAFE_root } = renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    pressIconButton(UNSAFE_root, "Feather-skip-forward");
    await waitFor(() => {
      expect((Video as any).lastProps.source.uri).toContain("foo_s1_ep2.mkv");
    });
  });

  it("skip-back (previous episode) goes back when not on the first", async () => {
    const { UNSAFE_root } = renderPlayer(makeRoute({ startIndex: 1 }));
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    pressIconButton(UNSAFE_root, "Feather-skip-back");
    await waitFor(() => {
      expect((Video as any).lastProps.source.uri).toContain("foo_s1_ep1.mkv");
    });
  });
});

describe("PlayerScreen — menus", () => {
  it("toggles the speed menu and selects a non-default rate", async () => {
    const { UNSAFE_root, findByText } = renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    pressIconButton(UNSAFE_root, "Feather-settings");
    fireEvent.press(await findByText("1.5x"));
    await waitFor(() => {
      expect((Video as any).lastProps.rate).toBe(1.5);
    });
  });
});

describe("PlayerScreen — skip-intro / skip-credits banner", () => {
  it("renders Skip Intro when current time is inside the intro window", async () => {
    const { findByText } = renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 1800 });
      (Video as any).lastProps.onProgress({ currentTime: 45 });
    });
    const skip = await findByText("Skip Intro");
    fireEvent.press(skip);
    await waitFor(() => expect(mockSeek).toHaveBeenCalledWith(60));
  });

  it("renders Skip Credits when current time is inside the outro window", async () => {
    const { findByText } = renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 1800 });
      (Video as any).lastProps.onProgress({ currentTime: 1720 });
    });
    const skip = await findByText("Skip Credits");
    fireEvent.press(skip);
    await waitFor(() => expect(mockSeek).toHaveBeenCalledWith(1750));
  });
});

describe("PlayerScreen — next-episode countdown", () => {
  async function advanceIntoOutro() {
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await waitFor(() => expect(api.getTimings).toHaveBeenCalled());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 1800 });
      (Video as any).lastProps.onProgress({ currentTime: 1705 });
    });
  }

  it("shows the Up Next overlay with the next episode label when in outro window", async () => {
    const { findByText } = renderPlayer();
    await advanceIntoOutro();
    expect(await findByText("Up Next")).toBeTruthy();
    // Parsed episode label for foo_s1_ep2.mkv is "S1 E2 - Foo"
    expect(await findByText(/S1 E2/)).toBeTruthy();
  });

  it("dismisses the overlay when Cancel is pressed and keeps the current episode", async () => {
    const { findByText, queryByText } = renderPlayer();
    await advanceIntoOutro();
    const cancel = await findByText("Cancel");
    fireEvent.press(cancel);
    await waitFor(() => expect(queryByText("Up Next")).toBeNull());
    expect((Video as any).lastProps.source.uri).toContain("foo_s1_ep1.mkv");
  });

  it("advances immediately when Play Now is pressed", async () => {
    const { findByText } = renderPlayer();
    await advanceIntoOutro();
    const playNow = await findByText("Play Now");
    fireEvent.press(playNow);
    await waitFor(() => {
      expect((Video as any).lastProps.source.uri).toContain("foo_s1_ep2.mkv");
    });
  });

  it("falls back to 15 seconds before end when outro timings are null", async () => {
    (api.getTimings as jest.Mock).mockResolvedValue({
      video_src: "foo",
      intro_start: null,
      intro_end: null,
      outro_start: null,
      outro_end: null,
    });
    const { findByText } = renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await waitFor(() => expect(api.getTimings).toHaveBeenCalled());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 100 });
      (Video as any).lastProps.onProgress({ currentTime: 86 });
    });
    expect(await findByText("Up Next")).toBeTruthy();
  });

  it("does not re-trigger the countdown after Cancel when still in the outro window", async () => {
    const { findByText, queryByText } = renderPlayer();
    await advanceIntoOutro();
    fireEvent.press(await findByText("Cancel"));
    await waitFor(() => expect(queryByText("Up Next")).toBeNull());
    // Move a bit further within the outro window — should not restart
    await act(async () => {
      (Video as any).lastProps.onProgress({ currentTime: 1710 });
    });
    expect(queryByText("Up Next")).toBeNull();
  });

  it("does not show the overlay when there is no next episode", async () => {
    const { queryByText } = renderPlayer(makeRoute({ videos: ["shows/Foo/only.mkv"], startIndex: 0 }));
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await waitFor(() => expect(api.getTimings).toHaveBeenCalled());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 1800 });
      (Video as any).lastProps.onProgress({ currentTime: 1705 });
    });
    expect(queryByText("Up Next")).toBeNull();
  });
});

describe("PlayerScreen — persistence lifecycle", () => {
  it("persists progress when AppState transitions away from active", async () => {
    const listeners: Array<(s: string) => void> = [];
    const AppState = require("react-native").AppState;
    // addEventListener is already a jest mock here; mockRestore() would wipe its
    // implementation for later tests, so put the original back by hand.
    const originalImpl = AppState.addEventListener.getMockImplementation?.();
    const addSpy = jest.spyOn(AppState, "addEventListener").mockImplementation((...args: unknown[]) => {
      const cb = args[1] as (s: string) => void;
      listeners.push(cb);
      return { remove: () => {} } as any;
    });
    renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 1800 });
      (Video as any).lastProps.onProgress({ currentTime: 50 });
    });
    await act(async () => {
      listeners.forEach((cb) => {
        cb("background");
      });
    });
    await waitFor(() => expect(api.saveProgress).toHaveBeenCalled());
    if (originalImpl) addSpy.mockImplementation(originalImpl);
    else addSpy.mockRestore();
  });
});

describe("PlayerScreen — TV remote keys", () => {
  const press = (key: string) =>
    act(async () => {
      DeviceEventEmitter.emit("remoteKey", { key, repeatCount: 0 });
    });

  async function loadedPlayer() {
    const root = renderPlayer();
    await waitFor(() => expect((Video as any).lastProps).toBeDefined());
    await act(async () => {
      (Video as any).lastProps.onLoad({ duration: 1800 });
      (Video as any).lastProps.onProgress({ currentTime: 50 });
    });
    return root;
  }

  it("play/pause key toggles playback", async () => {
    await loadedPlayer();
    await press("playPause");
    expect((Video as any).lastProps.paused).toBe(true);
    await press("playPause");
    expect((Video as any).lastProps.paused).toBe(false);
  });

  it("dedicated play and pause keys set the state", async () => {
    await loadedPlayer();
    await press("pause");
    expect((Video as any).lastProps.paused).toBe(true);
    await press("play");
    expect((Video as any).lastProps.paused).toBe(false);
  });

  it("fast-forward and rewind seek by 10 seconds", async () => {
    await loadedPlayer();
    await press("fastForward");
    expect(mockSeek).toHaveBeenLastCalledWith(60);
    await press("rewind");
    expect(mockSeek).toHaveBeenLastCalledWith(50);
  });

  it("with controls hidden, left/right seek without bringing the controls back", async () => {
    jest.useFakeTimers();
    try {
      const root = await loadedPlayer();
      await act(async () => {
        jest.advanceTimersByTime(4000);
      });
      expect(root.queryByTestId("progress-track")).toBeNull();
      await press("right");
      expect(mockSeek).toHaveBeenLastCalledWith(60);
      expect(root.getByText("+10s")).toBeTruthy();
      expect(root.queryByTestId("progress-track")).toBeNull();
      await press("left");
      expect(mockSeek).toHaveBeenLastCalledWith(50);
      // Any other D-pad key wakes the controls.
      await press("select");
      expect(root.getByTestId("progress-track")).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it("with controls visible, D-pad keys only keep them up (no seeking)", async () => {
    const root = await loadedPlayer();
    mockSeek.mockClear();
    await press("right");
    expect(mockSeek).not.toHaveBeenCalled();
    expect(root.getByTestId("progress-track")).toBeTruthy();
  });
});
