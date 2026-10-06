import React from "react";
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
