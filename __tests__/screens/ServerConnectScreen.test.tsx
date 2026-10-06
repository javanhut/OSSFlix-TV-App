import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { ServerConnectScreen } from "../../src/screens/ServerConnectScreen";
import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/state/session";

beforeEach(() => {
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: null,
    token: null,
    profile: null,
    selectedProfile: null,
  });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ServerConnectScreen", () => {
  it("renders the form with placeholder and connect button", () => {
    const { getByPlaceholderText, getByText } = render(<ServerConnectScreen />);
    expect(getByPlaceholderText("http://192.168.1.20:3000")).toBeTruthy();
    expect(getByText("Connect")).toBeTruthy();
  });

  it("on success, normalizes the URL, validates mobileAuth, and stores the server URL", async () => {
    const getServerInfo = jest
      .spyOn(api, "getServerInfo")
      .mockResolvedValue({ name: "srv", version: "1.0", mobileAuth: true });
    const { getByPlaceholderText, getByText } = render(<ServerConnectScreen />);

    fireEvent.changeText(getByPlaceholderText("http://192.168.1.20:3000"), "  media.local:8080  ");
    await act(async () => {
      fireEvent.press(getByText("Connect"));
    });

    await waitFor(() => {
      expect(getServerInfo).toHaveBeenCalledWith("http://media.local:8080");
      expect(useSessionStore.getState().serverUrl).toBe("http://media.local:8080");
    });
  });

  it("shows an alert when the server does not advertise mobile auth", async () => {
    jest.spyOn(api, "getServerInfo").mockResolvedValue({ name: "srv", version: "1.0", mobileAuth: false });
    const { getByPlaceholderText, getByText } = render(<ServerConnectScreen />);

    fireEvent.changeText(getByPlaceholderText("http://192.168.1.20:3000"), "media.local");
    await act(async () => {
      fireEvent.press(getByText("Connect"));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Connection failed",
        "This server does not advertise mobile auth support.",
      );
      expect(useSessionStore.getState().serverUrl).toBeNull();
    });
  });

  it("shows an alert with the error message when getServerInfo throws", async () => {
    jest.spyOn(api, "getServerInfo").mockRejectedValue(new Error("boom"));
    const { getByPlaceholderText, getByText } = render(<ServerConnectScreen />);

    fireEvent.changeText(getByPlaceholderText("http://192.168.1.20:3000"), "media.local");
    await act(async () => {
      fireEvent.press(getByText("Connect"));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Connection failed", "boom");
    });
  });

  it("shows a generic alert when the thrown value is not an Error", async () => {
    jest.spyOn(api, "getServerInfo").mockRejectedValue("weird");
    const { getByPlaceholderText, getByText } = render(<ServerConnectScreen />);

    fireEvent.changeText(getByPlaceholderText("http://192.168.1.20:3000"), "media.local");
    await act(async () => {
      fireEvent.press(getByText("Connect"));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Connection failed", "Unable to reach the server.");
    });
  });
});
