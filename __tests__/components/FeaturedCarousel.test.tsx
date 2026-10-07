import type React from "react";
import { Platform } from "react-native";
import { act, fireEvent, render as rtlRender } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeaturedCarousel } from "../../src/components/FeaturedCarousel";
import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/state/session";

function render(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.spyOn(api, "getTitleDetails").mockReturnValue(new Promise(() => {}) as any);
});

afterEach(() => {
  jest.restoreAllMocks();
});
import type { TitleSummary } from "../../src/types/api";

beforeEach(() => {
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: "http://media.local",
    token: null,
    profile: null,
    selectedProfile: null,
  });
});

const items: TitleSummary[] = [
  { name: "One", imagePath: "/api/assets/one.jpg", pathToDir: "movies/One" },
  { name: "Two", imagePath: "/api/assets/two.jpg", pathToDir: "movies/Two" },
  {
    name: "Three",
    imagePath: "/api/assets/three.jpg",
    pathToDir: "movies/Three",
  },
];

describe("FeaturedCarousel", () => {
  it("returns null when items is empty", () => {
    const { toJSON } = render(<FeaturedCarousel items={[]} height={400} onSelect={() => {}} />);
    expect(toJSON()).toBeNull();
  });

  it("renders every slide title", () => {
    const { getByText } = render(<FeaturedCarousel items={items} height={400} onSelect={() => {}} />);
    expect(getByText("One")).toBeTruthy();
    expect(getByText("Two")).toBeTruthy();
    expect(getByText("Three")).toBeTruthy();
  });

  it("fires onSelect when More Info is pressed on a slide", () => {
    const onSelect = jest.fn();
    const { getAllByText } = render(<FeaturedCarousel items={items} height={400} onSelect={onSelect} />);
    fireEvent.press(getAllByText("More Info")[0]);
    expect(onSelect).toHaveBeenCalledWith(items[0]);
  });

  it("fires onPlay when Play is pressed, and hides Play without a handler", () => {
    const onPlay = jest.fn();
    const { getAllByText, rerender, queryByText } = render(
      <FeaturedCarousel items={items} height={400} onSelect={() => {}} onPlay={onPlay} />,
    );
    fireEvent.press(getAllByText("Play")[0]);
    expect(onPlay).toHaveBeenCalledWith(items[0]);
    rerender(
      <QueryClientProvider client={new QueryClient()}>
        <FeaturedCarousel items={items} height={400} onSelect={() => {}} />
      </QueryClientProvider>,
    );
    expect(queryByText("Play")).toBeNull();
  });

  describe("auto-advance on a TV", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    // Indexes of the buttons that will take D-pad focus (each slide has Play, then More Info).
    function preferredPlaySlides(root: any) {
      const buttons = root.findAll(
        (node: any) =>
          typeof node.type === "string" &&
          node.props.accessibilityRole === "button" &&
          "hasTVPreferredFocus" in node.props,
      );
      return buttons.flatMap((node: any, i: number) => (node.props.hasTVPreferredFocus ? [i] : []));
    }

    function renderAdvancing() {
      const utils = render(<FeaturedCarousel items={items} height={400} onSelect={() => {}} onPlay={() => {}} />);
      fireEvent(utils.getByTestId("featured-carousel"), "layout", {
        nativeEvent: { layout: { width: 900, height: 400 } },
      });
      act(() => jest.advanceTimersByTime(50));
      return utils;
    }

    it("takes focus along to the next slide while the remote is on the hero", () => {
      const { getAllByText, UNSAFE_root } = renderAdvancing();
      // Buttons per slide: Play then More Info.
      expect(preferredPlaySlides(UNSAFE_root)).toEqual([0]);
      fireEvent(getAllByText("Play")[0], "focus");
      act(() => jest.advanceTimersByTime(8000));
      act(() => jest.advanceTimersByTime(50));
      expect(preferredPlaySlides(UNSAFE_root)).toEqual([2]);
    });

    it("leaves focus alone once the remote has moved off the hero", () => {
      const { getAllByText, UNSAFE_root } = renderAdvancing();
      fireEvent(getAllByText("Play")[0], "focus");
      fireEvent(getAllByText("Play")[0], "blur");
      act(() => jest.advanceTimersByTime(8000));
      act(() => jest.advanceTimersByTime(50));
      expect(preferredPlaySlides(UNSAFE_root)).toEqual([]);
    });
  });

  it("keeps the slide dots out of the D-pad's path on a TV", () => {
    const isTV = jest.spyOn(Platform, "isTV", "get").mockReturnValue(true);
    const { UNSAFE_root } = render(<FeaturedCarousel items={items} height={400} onSelect={() => {}} />);
    const dot = UNSAFE_root.find(
      (node: any) => typeof node.type === "string" && node.props.accessibilityLabel === "Show Two",
    );
    expect(dot.props.focusable).toBe(false);
    expect(dot.props.accessible).toBe(false);
    isTV.mockRestore();
  });

  it("shows the active title's description once it loads", async () => {
    jest.spyOn(api, "getTitleDetails").mockResolvedValue({ name: "One", description: "A great film." } as any);
    const { findByText } = render(<FeaturedCarousel items={items} height={400} onSelect={() => {}} />);
    expect(await findByText("A great film.")).toBeTruthy();
  });

  describe("on a wide (TV) stage", () => {
    const layout = (width: number) => ({ nativeEvent: { layout: { width, height: 400, x: 0, y: 0 } } });

    it("floats the sharp poster over a blurred backdrop, like the web hero", () => {
      const { getByTestId, getAllByTestId } = render(
        <FeaturedCarousel items={items} height={400} onSelect={() => {}} />,
      );
      fireEvent(getByTestId("featured-carousel"), "layout", layout(960));
      expect(getAllByTestId("hero-poster")).toHaveLength(items.length);
    });

    it("shows wide art full-bleed once it loads", () => {
      const { getByTestId, getAllByTestId, queryAllByTestId } = render(
        <FeaturedCarousel items={[items[0]]} height={400} onSelect={() => {}} />,
      );
      fireEvent(getByTestId("featured-carousel"), "layout", layout(960));
      fireEvent(getAllByTestId("hero-poster")[0], "load", { nativeEvent: { source: { width: 1920, height: 1080 } } });
      expect(queryAllByTestId("hero-poster")).toHaveLength(0);
    });

    it("keeps phones (narrow stage) on the plain full-bleed image", () => {
      const { getByTestId, queryAllByTestId } = render(
        <FeaturedCarousel items={items} height={400} onSelect={() => {}} />,
      );
      fireEvent(getByTestId("featured-carousel"), "layout", layout(360));
      expect(queryAllByTestId("hero-poster")).toHaveLength(0);
    });
  });
});
