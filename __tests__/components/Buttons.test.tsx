import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { GlassButton, PlayButton, PrimaryButton } from "../../src/components/Buttons";

describe.each([
  ["PlayButton", PlayButton],
  ["GlassButton", GlassButton],
  ["PrimaryButton", PrimaryButton],
])("%s", (_name, Button) => {
  it("renders its label and fires onPress", () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Go" icon="play" large onPress={onPress} />);
    fireEvent.press(getByText("Go"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("does not fire onPress when disabled", () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button label="Go" disabled onPress={onPress} />);
    fireEvent.press(getByText("Go"));
    expect(onPress).not.toHaveBeenCalled();
  });
});
