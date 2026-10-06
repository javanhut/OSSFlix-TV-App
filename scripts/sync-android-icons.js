#!/usr/bin/env node
/*
 * Regenerates Android launcher icons (legacy mipmaps + adaptive icon files)
 * from the `icon` and `android.adaptiveIcon` fields in app.json, writing into
 * android/app/src/main/res. Run after changing the app icon.
 */
const path = require("node:path");
const { setIconAsync } = require("@expo/prebuild-config/build/plugins/icons/withAndroidIcons");

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const app = require(path.join(projectRoot, "app.json")).expo;
  const adaptive = app.android?.adaptiveIcon ?? {};
  const foregroundImage = adaptive.foregroundImage ?? null;
  const backgroundImage = adaptive.backgroundImage ?? null;
  const monochromeImage = adaptive.monochromeImage ?? null;
  const backgroundColor = adaptive.backgroundColor ?? null;
  const icon = foregroundImage ?? app.icon ?? null;
  if (!icon) {
    console.error("No icon configured in app.json");
    process.exit(1);
  }
  await setIconAsync(projectRoot, {
    icon,
    backgroundColor,
    backgroundImage,
    monochromeImage,
    isAdaptive: Boolean(foregroundImage),
  });
  console.log("Android launcher icons regenerated.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
