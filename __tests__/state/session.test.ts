import { useSessionStore, buildSessionSnapshot } from "../../src/state/session";
import type { ProfileData, PublicProfile } from "../../src/types/api";

const FRESH_STATE = {
  bootstrapped: false,
  serverUrl: null,
  token: null,
  profile: null,
  selectedProfile: null,
};

const profile: ProfileData = {
  id: 1,
  name: "Ada",
  email: "ada@example.com",
} as ProfileData;

const publicProfile: PublicProfile = {
  id: 1,
  name: "Ada",
} as PublicProfile;

beforeEach(() => {
  useSessionStore.setState(FRESH_STATE);
});

describe("useSessionStore", () => {
  it("starts with the documented defaults", () => {
    const state = useSessionStore.getState();
    expect(state.bootstrapped).toBe(false);
    expect(state.serverUrl).toBeNull();
    expect(state.token).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.selectedProfile).toBeNull();
  });

  it("setServerUrl resets auth-related state", () => {
    useSessionStore.setState({
      token: "tok",
      profile,
      selectedProfile: publicProfile,
    });
    useSessionStore.getState().setServerUrl("http://media.local");
    const state = useSessionStore.getState();
    expect(state.serverUrl).toBe("http://media.local");
    expect(state.token).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.selectedProfile).toBeNull();
  });

  it("setAuthenticatedSession stores token and profile", () => {
    useSessionStore.getState().setAuthenticatedSession("tok", profile);
    const state = useSessionStore.getState();
    expect(state.token).toBe("tok");
    expect(state.profile).toEqual(profile);
  });

  it("clearAuth wipes token, profile, and selectedProfile but keeps serverUrl", () => {
    useSessionStore.setState({
      serverUrl: "http://media.local",
      token: "tok",
      profile,
      selectedProfile: publicProfile,
    });
    useSessionStore.getState().clearAuth();
    const state = useSessionStore.getState();
    expect(state.serverUrl).toBe("http://media.local");
    expect(state.token).toBeNull();
    expect(state.profile).toBeNull();
    expect(state.selectedProfile).toBeNull();
  });

  it("hydrate marks the store bootstrapped", () => {
    useSessionStore.getState().hydrate({
      serverUrl: "http://media.local",
      token: "tok",
      profile,
      selectedProfile: publicProfile,
    });
    const state = useSessionStore.getState();
    expect(state.bootstrapped).toBe(true);
    expect(state.serverUrl).toBe("http://media.local");
    expect(state.profile).toEqual(profile);
    expect(state.selectedProfile).toEqual(publicProfile);
  });
});

describe("buildSessionSnapshot", () => {
  it("mirrors the persistable slice of the store", () => {
    useSessionStore.setState({
      serverUrl: "http://media.local",
      token: "tok",
      profile,
      selectedProfile: publicProfile,
      bootstrapped: true,
    });
    expect(buildSessionSnapshot()).toEqual({
      serverUrl: "http://media.local",
      token: "tok",
      profile,
      selectedProfile: publicProfile,
    });
  });

  it("returns null fields when nothing is set", () => {
    expect(buildSessionSnapshot()).toEqual({
      serverUrl: null,
      token: null,
      profile: null,
      selectedProfile: null,
    });
  });
});
