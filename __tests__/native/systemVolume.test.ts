/**
 * systemVolume bridges to a native module on Android. We test all branches:
 * - Android with the native module present
 * - Android with the native module missing (fallback)
 * - Non-Android (fallback)
 * - Volume clamping for both get and set, including saturation from the native side.
 */

type SystemVolumeModule = typeof import("../../src/native/systemVolume");

function loadWithReactNativeMock(rnMock: Record<string, unknown>): SystemVolumeModule {
  let mod!: SystemVolumeModule;
  jest.isolateModules(() => {
    jest.doMock("react-native", () => rnMock);
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mod = require("../../src/native/systemVolume");
  });
  return mod;
}

const platformMock = (os: "android" | "ios" | "web") => ({
  NativeModules: { SystemVolume: undefined },
  Platform: {
    OS: os,
    select: (obj: Record<string, unknown>) => obj[os] ?? obj.default,
  },
});

const androidWithModule = (impl: { getMusicVolume: jest.Mock; setMusicVolume: jest.Mock }) => ({
  NativeModules: { SystemVolume: impl },
  Platform: {
    OS: "android",
    select: (obj: Record<string, unknown>) => obj.android ?? obj.default,
  },
});

describe("systemVolume on non-Android platforms", () => {
  it("getSystemMusicVolume returns 1 on iOS regardless of native module presence", async () => {
    const mod = loadWithReactNativeMock(platformMock("ios"));
    await expect(mod.getSystemMusicVolume()).resolves.toBe(1);
  });

  it("getSystemMusicVolumeInfo returns a fallback volume and max step count on iOS", async () => {
    const mod = loadWithReactNativeMock(platformMock("ios"));
    await expect(mod.getSystemMusicVolumeInfo()).resolves.toEqual({
      volume: 1,
      maxVolume: 15,
    });
  });

  it("setSystemMusicVolume clamps and returns the requested volume on iOS", async () => {
    const mod = loadWithReactNativeMock(platformMock("ios"));
    await expect(mod.setSystemMusicVolume(0.5)).resolves.toBe(0.5);
    await expect(mod.setSystemMusicVolume(2)).resolves.toBe(1);
    await expect(mod.setSystemMusicVolume(-1)).resolves.toBe(0);
  });
});

describe("systemVolume on Android without the native module installed", () => {
  it("getSystemMusicVolume returns 1", async () => {
    const mod = loadWithReactNativeMock(platformMock("android"));
    await expect(mod.getSystemMusicVolume()).resolves.toBe(1);
  });

  it("getSystemMusicVolumeInfo falls back when the richer native method is unavailable", async () => {
    const mod = loadWithReactNativeMock(platformMock("android"));
    await expect(mod.getSystemMusicVolumeInfo()).resolves.toEqual({
      volume: 1,
      maxVolume: 15,
    });
  });

  it("setSystemMusicVolume clamps and returns the requested volume", async () => {
    const mod = loadWithReactNativeMock(platformMock("android"));
    await expect(mod.setSystemMusicVolume(0.25)).resolves.toBe(0.25);
    await expect(mod.setSystemMusicVolume(5)).resolves.toBe(1);
  });
});

describe("systemVolume on Android with the native module", () => {
  it("getSystemMusicVolume reads from the native module", async () => {
    const impl = {
      getMusicVolume: jest.fn().mockResolvedValue(0.42),
      setMusicVolume: jest.fn(),
    };
    const mod = loadWithReactNativeMock(androidWithModule(impl));
    await expect(mod.getSystemMusicVolume()).resolves.toBe(0.42);
    expect(impl.getMusicVolume).toHaveBeenCalledTimes(1);
  });

  it("getSystemMusicVolumeInfo reads volume metadata from the native module", async () => {
    const impl = {
      getMusicVolume: jest.fn(),
      getMusicVolumeInfo: jest.fn().mockResolvedValue({ volume: 0.42, maxVolume: 25 }),
      setMusicVolume: jest.fn(),
    };
    const mod = loadWithReactNativeMock(androidWithModule(impl));
    await expect(mod.getSystemMusicVolumeInfo()).resolves.toEqual({
      volume: 0.42,
      maxVolume: 25,
    });
  });

  it("getSystemMusicVolume clamps an out-of-range native value", async () => {
    const impl = {
      getMusicVolume: jest.fn().mockResolvedValue(2),
      setMusicVolume: jest.fn(),
    };
    const mod = loadWithReactNativeMock(androidWithModule(impl));
    await expect(mod.getSystemMusicVolume()).resolves.toBe(1);
  });

  it("getSystemMusicVolume floors a negative native value at 0", async () => {
    const impl = {
      getMusicVolume: jest.fn().mockResolvedValue(-0.3),
      setMusicVolume: jest.fn(),
    };
    const mod = loadWithReactNativeMock(androidWithModule(impl));
    await expect(mod.getSystemMusicVolume()).resolves.toBe(0);
  });

  it("setSystemMusicVolume clamps the input before bridging and clamps the response", async () => {
    const impl = {
      getMusicVolume: jest.fn(),
      setMusicVolume: jest.fn().mockImplementation(async (v: number) => v),
    };
    const mod = loadWithReactNativeMock(androidWithModule(impl));
    await mod.setSystemMusicVolume(2);
    expect(impl.setMusicVolume).toHaveBeenLastCalledWith(1);
    await mod.setSystemMusicVolume(-1);
    expect(impl.setMusicVolume).toHaveBeenLastCalledWith(0);
  });

  it("setSystemMusicVolume clamps a saturated response from the native module", async () => {
    const impl = {
      getMusicVolume: jest.fn(),
      setMusicVolume: jest.fn().mockResolvedValue(1.4),
    };
    const mod = loadWithReactNativeMock(androidWithModule(impl));
    await expect(mod.setSystemMusicVolume(0.8)).resolves.toBe(1);
  });
});
