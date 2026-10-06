import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { ProfileSelectScreen } from "../../src/screens/ProfileSelectScreen";
import { useSessionStore } from "../../src/state/session";

const navigation = { navigate: jest.fn(), goBack: jest.fn() } as any;

const profiles = [
  { id: 1, name: "Ada", image_path: null, has_password: true },
  { id: 2, name: "Lin", image_path: null, has_password: false },
];

function buildRoute(source: "email" | "unclaimed" = "email") {
  return {
    key: "k",
    name: "ProfileSelect",
    params: { profiles, source },
  } as any;
}

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
});

describe("ProfileSelectScreen", () => {
  it("renders every profile as a card with status meta", () => {
    const { getByText, getAllByText } = render(<ProfileSelectScreen navigation={navigation} route={buildRoute()} />);
    expect(getByText("Your profiles")).toBeTruthy();
    expect(getByText("Ada")).toBeTruthy();
    expect(getByText("Lin")).toBeTruthy();
    expect(getAllByText("Password protected").length).toBeGreaterThanOrEqual(1);
    expect(getAllByText("Needs password").length).toBeGreaterThanOrEqual(1);
  });

  it('uses an "Unclaimed profiles" heading when source is unclaimed', () => {
    const { getByText } = render(<ProfileSelectScreen navigation={navigation} route={buildRoute("unclaimed")} />);
    expect(getByText("Unclaimed profiles")).toBeTruthy();
  });

  it("selects a profile and navigates to SignIn on card press", () => {
    const { getByLabelText } = render(<ProfileSelectScreen navigation={navigation} route={buildRoute()} />);
    fireEvent.press(getByLabelText("Choose Ada"));
    expect(useSessionStore.getState().selectedProfile?.id).toBe(1);
    expect(navigation.navigate).toHaveBeenCalledWith("SignIn");
  });

  it("Back goes back", () => {
    const { getByText } = render(<ProfileSelectScreen navigation={navigation} route={buildRoute()} />);
    fireEvent.press(getByText("Back"));
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it("renders empty state when no profiles provided", () => {
    const emptyRoute = {
      key: "k",
      name: "ProfileSelect",
      params: { profiles: [], source: "email" },
    } as any;
    const { getByText } = render(<ProfileSelectScreen navigation={navigation} route={emptyRoute} />);
    expect(getByText("No profiles")).toBeTruthy();
  });
});
