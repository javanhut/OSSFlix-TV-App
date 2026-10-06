import React from "react";
import { render } from "@testing-library/react-native";
import { EmptyState } from "../../src/components/EmptyState";

describe("EmptyState", () => {
  it("renders the title and subtitle text", () => {
    const { getByText } = render(<EmptyState title="No data" subtitle="Try again later" />);
    expect(getByText("No data")).toBeTruthy();
    expect(getByText("Try again later")).toBeTruthy();
  });
});
