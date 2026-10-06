const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

import React from "react";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { ProfileScreen } from "../../src/screens/ProfileScreen";
import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/state/session";
import { renderWithQuery } from "../utils/renderWithQuery";

function setProfile(profile: any) {
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: "http://media.local",
    token: "tok",
    profile,
    selectedProfile: null,
  });
}

beforeEach(() => {
  mockNavigate.mockReset();
  setProfile({
    id: 1,
    name: "Ada",
    email: "ada@example.com",
    image_path: null,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("ProfileScreen", () => {
  it("renders the profile card with name, email, and server URL", () => {
    const { getByText } = renderWithQuery(<ProfileScreen />);
    expect(getByText("Ada")).toBeTruthy();
    expect(getByText("ada@example.com")).toBeTruthy();
    expect(getByText("http://media.local")).toBeTruthy();
  });

  it("falls back to 'Guest' when there is no profile", () => {
    setProfile(null);
    const { getByText, queryByText } = renderWithQuery(<ProfileScreen />);
    expect(getByText("Guest")).toBeTruthy();
    expect(queryByText("Switch Profile")).toBeNull();
  });

  it("hides the Switch Profile button when the profile has no email", () => {
    setProfile({ id: 1, name: "Ada", email: null, image_path: null });
    const { queryByText } = renderWithQuery(<ProfileScreen />);
    expect(queryByText("Switch Profile")).toBeNull();
  });

  it("navigates to SwitchProfile when the button is pressed", () => {
    const { getByText } = renderWithQuery(<ProfileScreen />);
    fireEvent.press(getByText("Switch Profile"));
    expect(mockNavigate).toHaveBeenCalledWith("SwitchProfile");
  });

  it("sign-out modal: cancel dismisses without logging out", () => {
    const logoutSpy = jest.spyOn(api, "mobileLogout").mockResolvedValue({ ok: true });
    const { getAllByText, getByText } = renderWithQuery(<ProfileScreen />);
    fireEvent.press(getAllByText("Sign Out")[0]);
    fireEvent.press(getByText("Cancel"));
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(useSessionStore.getState().token).toBe("tok");
  });

  it("sign-out modal: confirm calls logout and clears auth", async () => {
    const logoutSpy = jest.spyOn(api, "mobileLogout").mockResolvedValue({ ok: true });
    const { getAllByText } = renderWithQuery(<ProfileScreen />);
    fireEvent.press(getAllByText("Sign Out")[0]);
    const buttons = getAllByText("Sign Out");
    await act(async () => {
      fireEvent.press(buttons[buttons.length - 1]);
    });
    await waitFor(() => {
      expect(logoutSpy).toHaveBeenCalled();
      expect(useSessionStore.getState().token).toBeNull();
    });
  });

  it("still clears auth even when the logout request fails", async () => {
    jest.spyOn(api, "mobileLogout").mockRejectedValue(new Error("offline"));
    const { getAllByText } = renderWithQuery(<ProfileScreen />);
    fireEvent.press(getAllByText("Sign Out")[0]);
    const buttons = getAllByText("Sign Out");
    await act(async () => {
      fireEvent.press(buttons[buttons.length - 1]);
    });
    await waitFor(() => {
      expect(useSessionStore.getState().token).toBeNull();
    });
  });
});
