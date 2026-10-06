import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { SignInScreen } from "../../src/screens/SignInScreen";
import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/state/session";

const navigation = { navigate: jest.fn(), goBack: jest.fn() } as any;
const route = { key: "sign-in", name: "SignIn" } as any;

const protectedProfile = {
  id: 1,
  name: "Ada",
  image_path: null,
  has_password: true,
};
const newProfile = {
  id: 2,
  name: "Lin",
  image_path: null,
  has_password: false,
};

beforeEach(() => {
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: "http://media.local",
    token: null,
    profile: null,
    selectedProfile: protectedProfile,
  });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("SignInScreen", () => {
  it("renders Sign In button when the selected profile already has a password", () => {
    const { getByText } = render(<SignInScreen navigation={navigation} route={route} />);
    expect(getByText("Sign In")).toBeTruthy();
    expect(getByText(/Enter the profile password/)).toBeTruthy();
  });

  it("renders Set Password when the selected profile has no password yet", () => {
    useSessionStore.setState({ selectedProfile: newProfile });
    const { getByText } = render(<SignInScreen navigation={navigation} route={route} />);
    expect(getByText("Set Password")).toBeTruthy();
    expect(getByText(/Set a password/)).toBeTruthy();
  });

  it("on Sign In success, stores the authenticated session", async () => {
    jest.spyOn(api, "mobileLogin").mockResolvedValue({
      token: "t",
      profile: { id: 1, name: "Ada" } as any,
      expiresAt: "",
    });
    const { getByPlaceholderText, getByText } = render(<SignInScreen navigation={navigation} route={route} />);
    fireEvent.changeText(getByPlaceholderText("Password"), "pw");
    await act(async () => {
      fireEvent.press(getByText("Sign In"));
    });
    await waitFor(() => {
      expect(api.mobileLogin).toHaveBeenCalledWith(1, "pw");
      expect(useSessionStore.getState().token).toBe("t");
    });
  });

  it("on Set Password success, stores the authenticated session", async () => {
    useSessionStore.setState({ selectedProfile: newProfile });
    jest.spyOn(api, "mobileSetPassword").mockResolvedValue({
      token: "t2",
      profile: { id: 2, name: "Lin" } as any,
      expiresAt: "",
    });
    const { getByPlaceholderText, getByText } = render(<SignInScreen navigation={navigation} route={route} />);
    fireEvent.changeText(getByPlaceholderText("Password"), "newpw");
    await act(async () => {
      fireEvent.press(getByText("Set Password"));
    });
    await waitFor(() => {
      expect(api.mobileSetPassword).toHaveBeenCalledWith(2, "newpw");
      expect(useSessionStore.getState().token).toBe("t2");
    });
  });

  it("alerts when login throws", async () => {
    jest.spyOn(api, "mobileLogin").mockRejectedValue(new Error("bad"));
    const { getByPlaceholderText, getByText } = render(<SignInScreen navigation={navigation} route={route} />);
    fireEvent.changeText(getByPlaceholderText("Password"), "pw");
    await act(async () => {
      fireEvent.press(getByText("Sign In"));
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Authentication failed", "bad");
    });
  });

  it("uses a generic message when login rejects with a non-Error", async () => {
    jest.spyOn(api, "mobileLogin").mockRejectedValue("weird");
    const { getByPlaceholderText, getByText } = render(<SignInScreen navigation={navigation} route={route} />);
    fireEvent.changeText(getByPlaceholderText("Password"), "pw");
    await act(async () => {
      fireEvent.press(getByText("Sign In"));
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Authentication failed", "Unable to sign in.");
    });
  });

  it("goes back when no profile is selected", async () => {
    useSessionStore.setState({ selectedProfile: null });
    const { getByText } = render(<SignInScreen navigation={navigation} route={route} />);
    await act(async () => {
      fireEvent.press(getByText("Sign In"));
    });
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it("Back action calls navigation.goBack", () => {
    const { getByText } = render(<SignInScreen navigation={navigation} route={route} />);
    fireEvent.press(getByText("Back"));
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
