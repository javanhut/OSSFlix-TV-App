import React from "react";
import { Dimensions, FlatList, Text } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

import { PosterGrid } from "../../src/components/PosterGrid";
import { HEADER_SPACE, SCREEN_GUTTER } from "../../src/components/PageHero";
import { GRID_GAP } from "../../src/hooks/usePosterGrid";

const items = Array.from({ length: 20 }, (_, i) => ({
  name: `Title ${i}`,
  pathToDir: `movies/${i}`,
  imagePath: null,
}));

afterEach(() => {
  jest.restoreAllMocks();
});

describe("PosterGrid", () => {
  it("glides the focused card's row to the top, and back to the header for the first row", () => {
    const scrollSpy = jest.spyOn(FlatList.prototype, "scrollToOffset").mockImplementation(() => {});
    const { getByLabelText, getByText } = render(
      <PosterGrid items={items} header={<Text>Movies</Text>} empty={<Text>Nothing</Text>} onSelect={() => {}} />,
    );
    fireEvent(getByText("Movies"), "layout", { nativeEvent: { layout: { x: 0, y: 0, width: 300, height: 200 } } });

    // Same maths as usePosterGrid.
    const { width } = Dimensions.get("window");
    const columns = Math.max(3, Math.floor((width - SCREEN_GUTTER * 2 + GRID_GAP) / (150 + GRID_GAP)));
    const cardWidth = Math.floor((width - SCREEN_GUTTER * 2 - GRID_GAP * (columns - 1)) / columns);
    const stride = cardWidth * 1.5 + GRID_GAP;

    fireEvent(getByLabelText(`Title ${columns * 2}`), "focus");
    expect(scrollSpy).toHaveBeenLastCalledWith({
      offset: SCREEN_GUTTER + 200 + 2 * stride - 14 - HEADER_SPACE,
      animated: true,
    });

    fireEvent(getByLabelText("Title 1"), "focus");
    expect(scrollSpy).toHaveBeenLastCalledWith({ offset: 0, animated: true });
  });

  it("passes the pressed title to onSelect", () => {
    const onSelect = jest.fn();
    const { getByLabelText } = render(
      <PosterGrid items={items} header={<Text>Movies</Text>} empty={<Text>Nothing</Text>} onSelect={onSelect} />,
    );
    fireEvent.press(getByLabelText("Title 3"));
    expect(onSelect).toHaveBeenCalledWith(items[3]);
  });
});
