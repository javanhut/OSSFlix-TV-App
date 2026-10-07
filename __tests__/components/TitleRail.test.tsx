// The test renderer has no native views, so stand in a fake native handle (42) for any view that asks.
jest.mock("../../src/utils/tv", () => ({
  ...jest.requireActual("../../src/utils/tv"),
  useNativeHandle: (enabled = true) => [() => {}, enabled ? 42 : undefined],
}));

import React from "react";
import { FlatList, StyleSheet } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { TitleRail } from "../../src/components/TitleRail";
import { useSessionStore } from "../../src/state/session";
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

describe("TitleRail", () => {
  const items: TitleSummary[] = [
    { name: "Inception", imagePath: null, pathToDir: "movies/Inception" },
    { name: "Arrival", imagePath: null, pathToDir: "movies/Arrival" },
  ];

  it("stops D-pad right at the last card instead of letting it drop into another row", () => {
    const { getByLabelText } = render(<TitleRail title="Featured" items={items} onSelect={() => {}} />);
    expect(getByLabelText("Arrival").props.nextFocusRight).toBe(42);
    expect(getByLabelText("Inception").props.nextFocusRight).toBeUndefined();
  });

  it("turns the heading blue while a card in the row has focus", () => {
    const { getByText, getByLabelText } = render(<TitleRail title="Featured" items={items} onSelect={() => {}} />);
    const color = () => StyleSheet.flatten(getByText("Featured").props.style).color;
    const idle = color();
    fireEvent(getByLabelText("Inception"), "focus");
    expect(color()).toBe("#60a5fa");
    fireEvent(getByLabelText("Inception"), "blur");
    expect(color()).toBe(idle);
  });

  it("glides the row so the focused card sits in the second slot, and reports row focus", () => {
    const scrollSpy = jest.spyOn(FlatList.prototype, "scrollToOffset").mockImplementation(() => {});
    const onRowFocus = jest.fn();
    const many: TitleSummary[] = Array.from({ length: 6 }, (_, i) => ({
      name: `Title ${i}`,
      imagePath: null,
      pathToDir: `movies/${i}`,
    }));
    const { getByLabelText } = render(
      <TitleRail title="Row" items={many} onSelect={() => {}} onRowFocus={onRowFocus} />,
    );
    fireEvent(getByLabelText("Title 3"), "focus");
    expect(onRowFocus).toHaveBeenCalledTimes(1);
    // Card 3 lands in slot 1: two card strides (140 + 14 gap) in.
    expect(scrollSpy).toHaveBeenCalledWith({ offset: 2 * 154, animated: true });
    scrollSpy.mockRestore();
  });

  it("returns null when items is empty", () => {
    const { toJSON } = render(<TitleRail title="Featured" items={[]} onSelect={() => {}} />);
    expect(toJSON()).toBeNull();
  });

  it("renders the heading and the items when present", () => {
    const { getByText, getAllByText } = render(<TitleRail title="Featured" items={items} onSelect={() => {}} />);
    expect(getByText("Featured")).toBeTruthy();
    // Each item renders its title in a placeholder + caption — 2 occurrences each.
    expect(getAllByText("Inception").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Arrival").length).toBeGreaterThanOrEqual(1);
  });

  it("calls onSelect with the right item when a card is pressed", () => {
    const onSelect = jest.fn();
    const { getAllByText } = render(<TitleRail title="Featured" items={items} onSelect={onSelect} />);
    fireEvent.press(getAllByText("Arrival")[0]);
    expect(onSelect).toHaveBeenCalledWith(items[1]);
  });
});
