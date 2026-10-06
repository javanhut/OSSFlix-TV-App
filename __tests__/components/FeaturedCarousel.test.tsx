import type React from "react";
import { fireEvent, render as rtlRender } from "@testing-library/react-native";
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

  it("shows the active title's description once it loads", async () => {
    jest.spyOn(api, "getTitleDetails").mockResolvedValue({ name: "One", description: "A great film." } as any);
    const { findByText } = render(<FeaturedCarousel items={items} height={400} onSelect={() => {}} />);
    expect(await findByText("A great film.")).toBeTruthy();
  });
});
