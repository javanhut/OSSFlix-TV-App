import React from "react";
import { render } from "@testing-library/react-native";
import { TvBanner } from "../../src/components/TvBanner";

describe("TvBanner", () => {
  it("shows the art at the given height", () => {
    const { getByTestId } = render(<TvBanner uri="http://x/banner.jpg" height={300} fadeTo="#000" />);
    expect(getByTestId("tv-banner-image").props.source).toEqual({ uri: "http://x/banner.jpg" });
    expect(getByTestId("tv-banner").props.style).toEqual(expect.arrayContaining([{ height: 300 }]));
  });

  it("renders just the fades when there is no art", () => {
    const { queryByTestId, getByTestId } = render(<TvBanner uri={null} height={300} fadeTo="#000" />);
    expect(getByTestId("tv-banner")).toBeTruthy();
    expect(queryByTestId("tv-banner-image")).toBeNull();
  });
});
