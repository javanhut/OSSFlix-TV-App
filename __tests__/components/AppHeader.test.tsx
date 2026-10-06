import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { AppHeader } from "../../src/components/AppHeader";

describe("AppHeader", () => {
  it("renders title only when no other props are given", () => {
    const { getByText, queryByText } = render(<AppHeader title="Hello" />);
    expect(getByText("Hello")).toBeTruthy();
    expect(queryByText("eyebrow")).toBeNull();
  });

  it("renders the subtitle when provided", () => {
    const { getByText } = render(<AppHeader title="Hello" subtitle="A subtitle" />);
    expect(getByText("A subtitle")).toBeTruthy();
  });

  it("does not render the action button when only actionLabel is provided", () => {
    const { queryByText } = render(<AppHeader title="Hello" actionLabel="Back" />);
    expect(queryByText("Back")).toBeNull();
  });

  it("does not render the action button when only onAction is provided", () => {
    const onAction = jest.fn();
    const { queryByText } = render(<AppHeader title="Hello" onAction={onAction} />);
    expect(queryByText("Back")).toBeNull();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("renders and calls onAction when both actionLabel and onAction are provided", () => {
    const onAction = jest.fn();
    const { getByText } = render(<AppHeader title="Hello" actionLabel="Back" onAction={onAction} />);
    fireEvent.press(getByText("Back"));
    expect(onAction).toHaveBeenCalledTimes(1);
  });
});
