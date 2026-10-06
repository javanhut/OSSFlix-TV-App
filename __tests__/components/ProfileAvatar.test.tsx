import React from "react";
import { Image } from "react-native";
import { render } from "@testing-library/react-native";
import { ProfileAvatar } from "../../src/components/ProfileAvatar";
import { useSessionStore } from "../../src/state/session";

beforeEach(() => {
  useSessionStore.setState({
    bootstrapped: false,
    serverUrl: "http://media.local",
    token: null,
    profile: null,
    selectedProfile: null,
  });
});

describe("ProfileAvatar", () => {
  it("shows the profile picture when there is one", () => {
    const { UNSAFE_getByType } = render(
      <ProfileAvatar profile={{ id: 1, name: "Ada", image_path: "/avatars/ada.png" }} size={80} />,
    );
    expect(UNSAFE_getByType(Image).props.source).toEqual({ uri: "http://media.local/avatars/ada.png" });
  });

  it("falls back to the uppercase initial", () => {
    const { getByText, UNSAFE_queryByType } = render(
      <ProfileAvatar profile={{ id: 2, name: "  lin", image_path: null }} size={80} />,
    );
    expect(getByText("L")).toBeTruthy();
    expect(UNSAFE_queryByType(Image)).toBeNull();
  });
});
