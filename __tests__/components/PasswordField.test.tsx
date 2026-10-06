import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { PasswordField } from "../../src/components/PasswordField";

describe("PasswordField", () => {
  it("starts obscured and toggles visibility on press", () => {
    const { getByPlaceholderText, getByLabelText, UNSAFE_root } = render(
      <PasswordField value="" onChangeText={() => {}} placeholder="Password" />,
    );
    const input = getByPlaceholderText("Password");
    expect(input.props.secureTextEntry).toBe(true);

    fireEvent.press(getByLabelText("Show password"));
    expect(getByPlaceholderText("Password").props.secureTextEntry).toBe(false);

    fireEvent.press(getByLabelText("Hide password"));
    expect(getByPlaceholderText("Password").props.secureTextEntry).toBe(true);

    expect(UNSAFE_root).toBeTruthy();
  });

  it("forwards onChangeText", () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = render(<PasswordField value="" onChangeText={onChange} placeholder="Password" />);
    fireEvent.changeText(getByPlaceholderText("Password"), "hunter2");
    expect(onChange).toHaveBeenCalledWith("hunter2");
  });
});
