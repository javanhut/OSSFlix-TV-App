// Replace @expo/vector-icons with a noop component so we avoid font-loading
// state updates that trigger React act() warnings during render tests.
jest.mock("@expo/vector-icons", () => {
  const React = require("react");
  const { Text } = require("react-native");
  const makeIcon = (familyName) => {
    const Icon = ({ name, ...rest }) =>
      React.createElement(Text, { ...rest, accessibilityLabel: `${familyName}-${name}` }, "");
    Icon.displayName = familyName;
    return Icon;
  };
  return new Proxy(
    {},
    {
      get: (_, prop) => makeIcon(String(prop)),
    },
  );
});

// Screens read safe-area insets; use the library's mock so they render without a provider.
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

// PosterWall checks reduce-motion asynchronously; leave it pending so screens don't
// get state updates after a test finishes. PosterWall's own test overrides this.
require("react-native").AccessibilityInfo.isReduceMotionEnabled = () => new Promise(() => {});

// Fonts are bundled assets; report them as loaded so screens render immediately.
jest.mock("expo-font", () => ({
  useFonts: () => [true, null],
  loadAsync: jest.fn(async () => {}),
  isLoaded: () => true,
}));

// In-memory expo-file-system/legacy so download storage/manager tests can run without
// native modules and still round-trip the manifest through read/write.
jest.mock("expo-file-system/legacy", () => {
  const store = new Map();
  return {
    documentDirectory: "file:///documents/",
    getInfoAsync: jest.fn(async (uri) => ({ exists: store.has(uri), uri })),
    readAsStringAsync: jest.fn(async (uri) => {
      if (!store.has(uri)) throw new Error(`ENOENT: ${uri}`);
      return store.get(uri);
    }),
    writeAsStringAsync: jest.fn(async (uri, contents) => {
      store.set(uri, contents);
    }),
    deleteAsync: jest.fn(async (uri) => {
      store.delete(uri);
    }),
    makeDirectoryAsync: jest.fn(async (uri) => {
      store.set(uri, "");
    }),
    downloadAsync: jest.fn(async (_uri, fileUri) => {
      store.set(fileUri, "binary");
      return { uri: fileUri, status: 200 };
    }),
    createDownloadResumable: jest.fn((_uri, fileUri, _options, callback) => ({
      downloadAsync: jest.fn(async () => {
        if (callback)
          callback({
            totalBytesWritten: 1000,
            totalBytesExpectedToWrite: 1000,
          });
        store.set(fileUri, "binary");
        return { uri: fileUri, status: 200 };
      }),
      resumeAsync: jest.fn(async () => {
        store.set(fileUri, "binary");
        return { uri: fileUri, status: 200 };
      }),
      pauseAsync: jest.fn(async () => ({ resumeData: "resume-token" })),
    })),
    __store: store,
  };
});

// Silence noisy logs that originate inside mocked native modules.
const originalWarn = console.warn;
jest.spyOn(console, "warn").mockImplementation((...args) => {
  const first = args[0];
  if (typeof first === "string" && /VirtualizedLists|act\(/.test(first)) return;
  originalWarn(...args);
});
