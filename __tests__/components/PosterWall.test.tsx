import React from "react";
import { AccessibilityInfo, Image } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { PosterWall } from "../../src/components/PosterWall";
import { useSessionStore } from "../../src/state/session";

beforeEach(() => {
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: "http://media.local",
    token: null,
    profile: null,
    selectedProfile: null,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

function layout(utils: ReturnType<typeof render>, width = 400) {
  act(() => {
    fireEvent(utils.getByTestId("poster-wall"), "layout", {
      nativeEvent: { layout: { width, height: 600, x: 0, y: 0 } },
    });
  });
}

const posters = (n: number) => Array.from({ length: n }, (_, i) => `/images/p${i}.jpg`);

describe("PosterWall", () => {
  it("renders nothing until it has been measured", () => {
    const utils = render(<PosterWall images={posters(10)} />);
    expect(utils.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it("fills every tile with a poster when the library is large enough", () => {
    const utils = render(<PosterWall images={posters(10)} columns={4} />);
    layout(utils);
    // 4 columns x 6 tiles, each column rendered twice for the loop.
    expect(utils.UNSAFE_getAllByType(Image)).toHaveLength(48);
  });

  it("de-duplicates images, drops empty ones and resolves them against the server", () => {
    const utils = render(<PosterWall images={["/images/a.jpg", "/images/a.jpg", null, undefined, ""]} columns={1} />);
    layout(utils);
    const sources = utils.UNSAFE_getAllByType(Image).map((img) => img.props.source.uri);
    expect(new Set(sources)).toEqual(new Set(["http://media.local/images/a.jpg"]));
  });

  it("mixes in abstract tiles for sparse libraries", () => {
    const utils = render(<PosterWall images={posters(2)} columns={2} />);
    layout(utils);
    // Only every third tile (n = 0, 3, 6, 9) gets a poster: 4 per copy, 8 total.
    expect(utils.UNSAFE_getAllByType(Image)).toHaveLength(8);
  });

  it("is entirely abstract with no images", () => {
    const utils = render(<PosterWall columns={3} />);
    layout(utils);
    expect(utils.UNSAFE_queryAllByType(Image)).toHaveLength(0);
  });

  it("follows the reduce-motion setting", async () => {
    let listener: ((value: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(true);
    jest.spyOn(AccessibilityInfo, "addEventListener").mockImplementation(((_: string, cb: (v: boolean) => void) => {
      listener = cb;
      return { remove: jest.fn() };
    }) as any);
    const utils = render(<PosterWall images={posters(10)} columns={2} />);
    layout(utils);
    await act(async () => {});
    act(() => listener?.(false));
    expect(utils.UNSAFE_getAllByType(Image)).toHaveLength(24);
    utils.unmount();
  });
});
