jest.mock("expo-secure-store", () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => {}),
  deleteItemAsync: jest.fn(async () => {}),
}));

jest.mock("expo-navigation-bar", () => ({
  setVisibilityAsync: jest.fn(async () => {}),
  setStyle: jest.fn(),
}));

jest.mock("expo-screen-orientation", () => ({
  lockAsync: jest.fn(async () => {}),
  unlockAsync: jest.fn(async () => {}),
  OrientationLock: {
    PORTRAIT_UP: 1,
    LANDSCAPE: 4,
    DEFAULT: 0,
  },
}));

jest.mock("react-native-video", () => ({
  __esModule: true,
  default: () => null,
}));

/**
 * Smoke-imports every src/ module so a parse error, missing import, or
 * top-level evaluation failure surfaces as a test failure rather than
 * a runtime crash on device.
 */
describe("compile check: every src/ module imports cleanly", () => {
  const modules: Array<[string, () => unknown]> = [
    ["src/types/api", () => require("../src/types/api")],
    ["src/theme/colors", () => require("../src/theme/colors")],
    ["src/storage/sessionStorage", () => require("../src/storage/sessionStorage")],
    ["src/storage/downloadsStorage", () => require("../src/storage/downloadsStorage")],
    ["src/state/session", () => require("../src/state/session")],
    ["src/state/downloads", () => require("../src/state/downloads")],
    ["src/types/downloads", () => require("../src/types/downloads")],
    ["src/downloads/downloadManager", () => require("../src/downloads/downloadManager")],
    ["src/api/client", () => require("../src/api/client")],
    ["src/native/systemVolume", () => require("../src/native/systemVolume")],
    ["src/components/TitleCard", () => require("../src/components/TitleCard")],
    ["src/components/TitleRail", () => require("../src/components/TitleRail")],
    ["src/components/AppHeader", () => require("../src/components/AppHeader")],
    ["src/components/EmptyState", () => require("../src/components/EmptyState")],
    ["src/screens/ServerConnectScreen", () => require("../src/screens/ServerConnectScreen")],
    ["src/screens/ProfileLookupScreen", () => require("../src/screens/ProfileLookupScreen")],
    ["src/screens/SignInScreen", () => require("../src/screens/SignInScreen")],
    ["src/screens/RegisterScreen", () => require("../src/screens/RegisterScreen")],
    ["src/screens/HomeScreen", () => require("../src/screens/HomeScreen")],
    ["src/screens/LibraryScreen", () => require("../src/screens/LibraryScreen")],
    ["src/screens/SearchScreen", () => require("../src/screens/SearchScreen")],
    ["src/screens/WatchlistScreen", () => require("../src/screens/WatchlistScreen")],
    ["src/screens/TitleDetailsScreen", () => require("../src/screens/TitleDetailsScreen")],
    ["src/screens/PlayerScreen", () => require("../src/screens/PlayerScreen")],
    ["src/screens/DownloadsScreen", () => require("../src/screens/DownloadsScreen")],
    ["src/navigation/RootNavigator", () => require("../src/navigation/RootNavigator")],
    ["src/providers/AppProviders", () => require("../src/providers/AppProviders")],
  ];

  it.each(modules)("imports %s without throwing", (_name, load) => {
    expect(load).not.toThrow();
    expect(load()).toBeTruthy();
  });
});
