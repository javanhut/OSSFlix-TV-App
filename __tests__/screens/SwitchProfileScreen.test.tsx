const navigation = { navigate: jest.fn(), goBack: jest.fn() } as any;
const route = { key: "k", name: "SwitchProfile", params: undefined } as any;

import React from "react";
import { Alert } from "react-native";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { SwitchProfileScreen } from "../../src/screens/SwitchProfileScreen";
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
  navigation.navigate.mockReset();
  navigation.goBack.mockReset();
  setProfile({
    id: 1,
    name: "Ada",
    email: "ada@example.com",
    image_path: null,
  });
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("SwitchProfileScreen", () => {
  it("shows the no-email empty state when the profile has no email", () => {
    setProfile({ id: 1, name: "Ada", email: null, image_path: null });
    const { getByText } = renderWithQuery(<SwitchProfileScreen navigation={navigation} route={route} />);
    expect(getByText("No email on this profile")).toBeTruthy();
  });

  it("renders the profiles returned for the current email", async () => {
    jest.spyOn(api, "lookupProfiles").mockResolvedValue({
      profiles: [
        { id: 1, name: "Ada", image_path: null, has_password: true },
        { id: 2, name: "Lin", image_path: null, has_password: false },
      ],
      hasUnclaimed: false,
    } as any);
    const { findByText, getByText } = renderWithQuery(<SwitchProfileScreen navigation={navigation} route={route} />);
    expect(await findByText("Ada")).toBeTruthy();
    expect(getByText("Lin")).toBeTruthy();
    expect(getByText("Current")).toBeTruthy();
  });

  it("returns to the previous screen when tapping the current profile", async () => {
    jest.spyOn(api, "lookupProfiles").mockResolvedValue({
      profiles: [{ id: 1, name: "Ada", image_path: null, has_password: true }],
      hasUnclaimed: false,
    } as any);
    const { findByText } = renderWithQuery(<SwitchProfileScreen navigation={navigation} route={route} />);
    fireEvent.press(await findByText("Ada"));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it("reveals a password field after selecting a different profile and logs in on submit", async () => {
    jest.spyOn(api, "lookupProfiles").mockResolvedValue({
      profiles: [
        { id: 1, name: "Ada", image_path: null, has_password: true },
        { id: 2, name: "Lin", image_path: null, has_password: true },
      ],
      hasUnclaimed: false,
    } as any);
    const loginSpy = jest.spyOn(api, "mobileLogin").mockResolvedValue({
      token: "new-tok",
      profile: {
        id: 2,
        name: "Lin",
        email: "ada@example.com",
        image_path: null,
        movies_directory: null,
        tvshows_directory: null,
        use_global_dirs: 1,
      },
      expiresAt: "2030-01-01",
    } as any);

    const { findByText, getByPlaceholderText } = renderWithQuery(
      <SwitchProfileScreen navigation={navigation} route={route} />,
    );
    fireEvent.press(await findByText("Lin"));
    fireEvent.changeText(getByPlaceholderText("Password"), "hunter2");
    await act(async () => {
      fireEvent.press(await findByText("Switch to this Profile"));
    });
    await waitFor(() => {
      expect(loginSpy).toHaveBeenCalledWith(2, "hunter2");
      expect(useSessionStore.getState().token).toBe("new-tok");
      expect(useSessionStore.getState().profile?.id).toBe(2);
    });
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it("uses mobileSetPassword when the target profile has no password yet", async () => {
    jest.spyOn(api, "lookupProfiles").mockResolvedValue({
      profiles: [
        { id: 1, name: "Ada", image_path: null, has_password: true },
        { id: 2, name: "Lin", image_path: null, has_password: false },
      ],
      hasUnclaimed: false,
    } as any);
    const setPwSpy = jest.spyOn(api, "mobileSetPassword").mockResolvedValue({
      token: "new-tok",
      profile: {
        id: 2,
        name: "Lin",
        email: "ada@example.com",
        image_path: null,
        movies_directory: null,
        tvshows_directory: null,
        use_global_dirs: 1,
      },
      expiresAt: "2030-01-01",
    } as any);

    const { findByText, getByPlaceholderText } = renderWithQuery(
      <SwitchProfileScreen navigation={navigation} route={route} />,
    );
    fireEvent.press(await findByText("Lin"));
    fireEvent.changeText(getByPlaceholderText("Password"), "newpass");
    await act(async () => {
      fireEvent.press(await findByText("Set Password & Switch"));
    });
    await waitFor(() => {
      expect(setPwSpy).toHaveBeenCalledWith(2, "newpass");
    });
  });

  it("alerts when submit is pressed with an empty password", async () => {
    jest.spyOn(api, "lookupProfiles").mockResolvedValue({
      profiles: [
        { id: 1, name: "Ada", image_path: null, has_password: true },
        { id: 2, name: "Lin", image_path: null, has_password: true },
      ],
      hasUnclaimed: false,
    } as any);
    const loginSpy = jest.spyOn(api, "mobileLogin");
    const { findByText } = renderWithQuery(<SwitchProfileScreen navigation={navigation} route={route} />);
    fireEvent.press(await findByText("Lin"));
    fireEvent.press(await findByText("Switch to this Profile"));
    expect(Alert.alert).toHaveBeenCalled();
    expect(loginSpy).not.toHaveBeenCalled();
  });

  it("shows the 'no other profiles' empty state when only one profile is returned", async () => {
    jest.spyOn(api, "lookupProfiles").mockResolvedValue({ profiles: [], hasUnclaimed: false } as any);
    const { findByText } = renderWithQuery(<SwitchProfileScreen navigation={navigation} route={route} />);
    expect(await findByText("No other profiles")).toBeTruthy();
  });
});
