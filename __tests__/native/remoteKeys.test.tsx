import React from "react";
import { DeviceEventEmitter } from "react-native";
import { act, render } from "@testing-library/react-native";
import { REMOTE_KEY_EVENT, type RemoteKeyEvent, useRemoteKeys } from "../../src/native/remoteKeys";

function Listener({ onKey, enabled }: { onKey: (e: RemoteKeyEvent) => void; enabled?: boolean }) {
  useRemoteKeys(onKey, enabled);
  return null;
}

const emit = (key: string) =>
  act(() => {
    DeviceEventEmitter.emit(REMOTE_KEY_EVENT, { key, repeatCount: 0 });
  });

describe("useRemoteKeys", () => {
  it("delivers key events to the latest handler until unmounted", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender, unmount } = render(<Listener onKey={first} />);
    emit("left");
    expect(first).toHaveBeenCalledWith({ key: "left", repeatCount: 0 });

    rerender(<Listener onKey={second} />);
    emit("select");
    expect(second).toHaveBeenCalledWith({ key: "select", repeatCount: 0 });
    expect(first).toHaveBeenCalledTimes(1);

    unmount();
    emit("right");
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does not listen while disabled", () => {
    const onKey = jest.fn();
    render(<Listener onKey={onKey} enabled={false} />);
    emit("up");
    expect(onKey).not.toHaveBeenCalled();
  });
});
