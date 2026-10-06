import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { RegisterScreen } from "../../src/screens/RegisterScreen";
import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/state/session";

beforeEach(() => {
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: "http://media.local",
    token: null,
    profile: null,
    selectedProfile: null,
  });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("RegisterScreen", () => {
  it("renders the registration form", () => {
    const { getByText, getByPlaceholderText } = render(<RegisterScreen />);
    expect(getByText("Create profile")).toBeTruthy();
    expect(getByPlaceholderText("Profile name")).toBeTruthy();
    expect(getByPlaceholderText("Email")).toBeTruthy();
    expect(getByPlaceholderText("Password")).toBeTruthy();
    expect(getByText("Create Account")).toBeTruthy();
  });

  it("on success, registers and stores the authenticated session", async () => {
    jest.spyOn(api, "mobileRegister").mockResolvedValue({
      token: "tok",
      profile: { id: 9, name: "Ada" } as any,
      expiresAt: "",
    });

    const { getByPlaceholderText, getByText } = render(<RegisterScreen />);
    fireEvent.changeText(getByPlaceholderText("Profile name"), "  Ada  ");
    fireEvent.changeText(getByPlaceholderText("Email"), "  ada@x.com  ");
    fireEvent.changeText(getByPlaceholderText("Password"), "pw");
    await act(async () => {
      fireEvent.press(getByText("Create Account"));
    });

    await waitFor(() => {
      expect(api.mobileRegister).toHaveBeenCalledWith("Ada", "ada@x.com", "pw");
      expect(useSessionStore.getState().token).toBe("tok");
    });
  });

  it("alerts when registration fails with an Error", async () => {
    jest.spyOn(api, "mobileRegister").mockRejectedValue(new Error("taken"));
    const { getByText } = render(<RegisterScreen />);
    await act(async () => {
      fireEvent.press(getByText("Create Account"));
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Registration failed", "taken");
    });
  });

  it("alerts with a generic message when registration rejects with a non-Error", async () => {
    jest.spyOn(api, "mobileRegister").mockRejectedValue("weird");
    const { getByText } = render(<RegisterScreen />);
    await act(async () => {
      fireEvent.press(getByText("Create Account"));
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Registration failed", "Unable to create the profile.");
    });
  });
});
