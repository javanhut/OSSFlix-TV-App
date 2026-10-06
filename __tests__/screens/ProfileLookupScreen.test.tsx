import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import { ProfileLookupScreen } from "../../src/screens/ProfileLookupScreen";
import { api } from "../../src/api/client";
import { useSessionStore } from "../../src/state/session";

const navigation = { navigate: jest.fn(), goBack: jest.fn() } as any;
const route = { key: "profile-lookup", name: "ProfileLookup" } as any;

beforeEach(() => {
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
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

describe("ProfileLookupScreen", () => {
  it("renders the form header and action buttons", () => {
    const { getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    expect(getByText("Welcome back")).toBeTruthy();
    expect(getByText("Find Profiles")).toBeTruthy();
    expect(getByText("Use Unclaimed Profile")).toBeTruthy();
    expect(getByText("Continue as Guest")).toBeTruthy();
    expect(getByText("Create a new profile")).toBeTruthy();
  });

  it("navigates to ProfileSelect when email lookup returns profiles", async () => {
    jest.spyOn(api, "lookupProfiles").mockResolvedValue({
      profiles: [
        { id: 1, name: "Ada", image_path: null, has_password: true },
        { id: 2, name: "Lin", image_path: null, has_password: false },
      ],
      hasUnclaimed: false,
    });

    const { getByPlaceholderText, getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    fireEvent.changeText(getByPlaceholderText("Email"), "  user@example.com  ");
    await act(async () => {
      fireEvent.press(getByText("Find Profiles"));
    });

    await waitFor(() => {
      expect(api.lookupProfiles).toHaveBeenCalledWith("user@example.com");
      expect(navigation.navigate).toHaveBeenCalledWith("ProfileSelect", {
        profiles: expect.any(Array),
        source: "email",
      });
    });
  });

  it("alerts when lookup returns no profiles and does not navigate", async () => {
    jest.spyOn(api, "lookupProfiles").mockResolvedValue({ profiles: [], hasUnclaimed: false });

    const { getByPlaceholderText, getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    fireEvent.changeText(getByPlaceholderText("Email"), "a@b.c");
    await act(async () => {
      fireEvent.press(getByText("Find Profiles"));
    });

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("No profiles", expect.stringContaining("No profiles"));
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("alerts when lookupProfiles throws", async () => {
    jest.spyOn(api, "lookupProfiles").mockRejectedValue(new Error("boom"));
    const { getByPlaceholderText, getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    fireEvent.changeText(getByPlaceholderText("Email"), "a@b.c");
    await act(async () => {
      fireEvent.press(getByText("Find Profiles"));
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Lookup failed", "boom");
    });
  });

  it("alerts with a fallback when lookupProfiles rejects with a non-Error", async () => {
    jest.spyOn(api, "lookupProfiles").mockRejectedValue("weird");
    const { getByPlaceholderText, getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    fireEvent.changeText(getByPlaceholderText("Email"), "a@b.c");
    await act(async () => {
      fireEvent.press(getByText("Find Profiles"));
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Lookup failed", "Unable to load profiles.");
    });
  });

  it("unclaimed: navigates to ProfileSelect when profiles are returned", async () => {
    jest.spyOn(api, "lookupUnclaimed").mockResolvedValue({
      profiles: [{ id: 5, name: "Open", image_path: null, has_password: false }],
    });
    const { getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    await act(async () => {
      fireEvent.press(getByText("Use Unclaimed Profile"));
    });
    await waitFor(() => {
      expect(navigation.navigate).toHaveBeenCalledWith("ProfileSelect", {
        profiles: expect.any(Array),
        source: "unclaimed",
      });
    });
  });

  it("unclaimed: alerts on empty result", async () => {
    jest.spyOn(api, "lookupUnclaimed").mockResolvedValue({ profiles: [] });
    const { getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    await act(async () => {
      fireEvent.press(getByText("Use Unclaimed Profile"));
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("No profiles", expect.stringContaining("unclaimed"));
    });
    expect(navigation.navigate).not.toHaveBeenCalled();
  });

  it("unclaimed: alerts with fallback on non-Error rejection", async () => {
    jest.spyOn(api, "lookupUnclaimed").mockRejectedValue("weird");
    const { getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    await act(async () => {
      fireEvent.press(getByText("Use Unclaimed Profile"));
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Lookup failed", "Unable to load profiles.");
    });
  });

  it("unclaimed: alerts with the error message on Error rejection", async () => {
    jest.spyOn(api, "lookupUnclaimed").mockRejectedValue(new Error("nope"));
    const { getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    await act(async () => {
      fireEvent.press(getByText("Use Unclaimed Profile"));
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Lookup failed", "nope");
    });
  });

  it("Continue as Guest selects the guest profile and navigates to SignIn", async () => {
    jest.spyOn(api, "getGuestProfile").mockResolvedValue({
      profile: { id: 9, name: "Guest", image_path: null, has_password: true },
    });
    const { getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    await act(async () => {
      fireEvent.press(getByText("Continue as Guest"));
    });
    await waitFor(() => {
      expect(useSessionStore.getState().selectedProfile?.id).toBe(9);
      expect(navigation.navigate).toHaveBeenCalledWith("SignIn");
    });
  });

  it("Continue as Guest alerts when the server returns an error", async () => {
    jest.spyOn(api, "getGuestProfile").mockRejectedValue(new Error("Guest profile not available"));
    const { getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    await act(async () => {
      fireEvent.press(getByText("Continue as Guest"));
    });
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Guest unavailable", "Guest profile not available");
    });
  });

  it("navigates to Register from the link", () => {
    const { getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    fireEvent.press(getByText("Create a new profile"));
    expect(navigation.navigate).toHaveBeenCalledWith("Register");
  });

  it("the Change action clears the configured server URL", () => {
    const { getByText } = render(<ProfileLookupScreen navigation={navigation} route={route} />);
    fireEvent.press(getByText("Change"));
    expect(useSessionStore.getState().serverUrl).toBe("");
  });
});
