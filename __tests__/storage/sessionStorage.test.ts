jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    __store: store,
    getItemAsync: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
});

import * as SecureStore from "expo-secure-store";
import { loadSessionSnapshot, saveSessionSnapshot } from "../../src/storage/sessionStorage";
import type { ProfileData, PublicProfile } from "../../src/types/api";

const mockedStore = (SecureStore as unknown as { __store: Map<string, string> }).__store;

const profile: ProfileData = {
  id: 1,
  name: "Ada",
  email: "ada@example.com",
} as ProfileData;
const publicProfile: PublicProfile = { id: 1, name: "Ada" } as PublicProfile;

beforeEach(() => {
  mockedStore.clear();
  jest.clearAllMocks();
});

describe("sessionStorage", () => {
  it("returns all-null snapshot when nothing is stored", async () => {
    const snapshot = await loadSessionSnapshot();
    expect(snapshot).toEqual({
      serverUrl: null,
      token: null,
      profile: null,
      selectedProfile: null,
    });
  });

  it("round-trips a populated snapshot through save and load", async () => {
    await saveSessionSnapshot({
      serverUrl: "http://media.local",
      token: "tok",
      profile,
      selectedProfile: publicProfile,
    });

    const snapshot = await loadSessionSnapshot();
    expect(snapshot).toEqual({
      serverUrl: "http://media.local",
      token: "tok",
      profile,
      selectedProfile: publicProfile,
    });
  });

  it('deletes keys for null fields rather than writing "null"', async () => {
    mockedStore.set("ossflix_mobile_token", "stale");
    mockedStore.set("ossflix_mobile_profile", JSON.stringify(profile));

    await saveSessionSnapshot({
      serverUrl: "http://media.local",
      token: null,
      profile: null,
      selectedProfile: null,
    });

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("ossflix_mobile_token");
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith("ossflix_mobile_profile");
    expect(mockedStore.has("ossflix_mobile_token")).toBe(false);
    expect(mockedStore.has("ossflix_mobile_profile")).toBe(false);
    expect(mockedStore.get("ossflix_mobile_server_url")).toBe("http://media.local");
  });
});
