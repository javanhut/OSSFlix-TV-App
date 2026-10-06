import React from "react";
import { StyleSheet, Text } from "react-native";
import { act, fireEvent, render } from "@testing-library/react-native";
import { Pressable } from "../../src/components/FocusPressable";

function flatStyle(node: any) {
  return StyleSheet.flatten(node.props.style);
}

describe("FocusPressable", () => {
  it("shows a focus ring only while focused, and forwards focus events", () => {
    const onFocus = jest.fn();
    const onBlur = jest.fn();
    const { getByTestId } = render(
      <Pressable testID="btn" onPress={() => {}} onFocus={onFocus} onBlur={onBlur} style={{ padding: 4 }}>
        <Text>Go</Text>
      </Pressable>,
    );
    expect(flatStyle(getByTestId("btn")).outlineWidth).toBeUndefined();

    act(() => fireEvent(getByTestId("btn"), "focus"));
    expect(flatStyle(getByTestId("btn"))).toMatchObject({ padding: 4, outlineWidth: 3, outlineColor: "#ffffff" });
    expect(onFocus).toHaveBeenCalledTimes(1);

    act(() => fireEvent(getByTestId("btn"), "blur"));
    expect(flatStyle(getByTestId("btn")).outlineWidth).toBeUndefined();
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it("adds focusStyle on top of the ring and supports function styles", () => {
    const { getByTestId } = render(
      <Pressable
        testID="btn"
        onPress={() => {}}
        style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        focusStyle={{ transform: [{ scale: 1.06 }] }}
      >
        <Text>Go</Text>
      </Pressable>,
    );
    act(() => fireEvent(getByTestId("btn"), "focus"));
    expect(flatStyle(getByTestId("btn"))).toMatchObject({ opacity: 1, transform: [{ scale: 1.06 }] });
  });

  it("still presses", () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <Pressable onPress={onPress}>
        <Text>Go</Text>
      </Pressable>,
    );
    fireEvent.press(getByText("Go"));
    expect(onPress).toHaveBeenCalled();
  });
});
