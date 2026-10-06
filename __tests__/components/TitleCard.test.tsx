import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { TitleCard } from "../../src/components/TitleCard";
import { useSessionStore } from "../../src/state/session";
import type { TitleSummary } from "../../src/types/api";

const SERVER = "http://media.local:9000";

beforeEach(() => {
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: SERVER,
    token: null,
    profile: null,
    selectedProfile: null,
  });
});

describe("TitleCard", () => {
  const baseItem: TitleSummary = {
    name: "Inception",
    imagePath: "/api/assets/inception.jpg",
    pathToDir: "movies/Inception",
  };

  it("renders an image when imagePath is set, resolved against the server URL", () => {
    const { UNSAFE_getByType } = render(<TitleCard item={baseItem} onPress={() => {}} />);
    const Image = require("react-native").Image;
    const image = UNSAFE_getByType(Image);
    expect(image.props.source).toEqual({
      uri: `${SERVER}/api/assets/inception.jpg`,
    });
  });

  it("falls back to a placeholder with the title text when imagePath is null", () => {
    const item = { ...baseItem, imagePath: null };
    const { getAllByText } = render(<TitleCard item={item} onPress={() => {}} />);
    expect(getAllByText("Inception").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the title text", () => {
    const { getByText } = render(<TitleCard item={baseItem} onPress={() => {}} />);
    expect(getByText("Inception")).toBeTruthy();
  });

  it("shows only the title, not a type badge (redesigned poster card)", () => {
    const item = { ...baseItem, type: "Movie" };
    const { queryByText } = render(<TitleCard item={item} onPress={() => {}} />);
    expect(queryByText("Movie")).toBeNull();
  });

  it("fires onPress when pressed", () => {
    const onPress = jest.fn();
    const { getByText } = render(<TitleCard item={baseItem} onPress={onPress} />);
    fireEvent.press(getByText("Inception"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not render a progress bar when progressPct is zero or missing", () => {
    const { queryByTestId } = render(<TitleCard item={baseItem} onPress={() => {}} />);
    expect(queryByTestId("title-card-progress")).toBeNull();

    const zero = { ...baseItem, progressPct: 0 };
    const { queryByTestId: queryZero } = render(<TitleCard item={zero} onPress={() => {}} />);
    expect(queryZero("title-card-progress")).toBeNull();
  });

  it("renders a progress fill sized to progressPct when set", () => {
    const item = { ...baseItem, progressPct: 42 };
    const { getByTestId } = render(<TitleCard item={item} onPress={() => {}} />);
    const fill = getByTestId("title-card-progress-fill");
    const flat = Array.isArray(fill.props.style) ? fill.props.style : [fill.props.style];
    const width = flat
      .map((s: { width?: string | number } | null | undefined) => s?.width)
      .find((w: string | number | undefined) => w !== undefined);
    expect(width).toBe("42%");
  });

  it("clamps progressPct above 100 to 100%", () => {
    const item = { ...baseItem, progressPct: 200 };
    const { getByTestId } = render(<TitleCard item={item} onPress={() => {}} />);
    const fill = getByTestId("title-card-progress-fill");
    const flat = Array.isArray(fill.props.style) ? fill.props.style : [fill.props.style];
    const width = flat
      .map((s: { width?: string | number } | null | undefined) => s?.width)
      .find((w: string | number | undefined) => w !== undefined);
    expect(width).toBe("100%");
  });
});
