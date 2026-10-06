/*
 * Android TV support for `expo prebuild`:
 *  - lists the app in the TV launcher (LEANBACK_LAUNCHER) with a 320x180 banner
 *  - marks touchscreen and leanback as optional so one APK serves phones and TVs
 * The checked-in android/ already has these changes; this keeps them on a regenerate.
 */
const fs = require("node:fs");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const BANNER_SOURCE = "assets/tv-banner.png";
const BANNER_NAME = "tv_banner";

function addUsesFeature(manifest, name) {
  manifest["uses-feature"] = manifest["uses-feature"] || [];
  if (!manifest["uses-feature"].some((f) => f.$["android:name"] === name)) {
    manifest["uses-feature"].push({ $: { "android:name": name, "android:required": "false" } });
  }
}

function withTvManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    addUsesFeature(manifest, "android.hardware.touchscreen");
    addUsesFeature(manifest, "android.software.leanback");

    const app = manifest.application[0];
    app.$["android:banner"] = `@drawable/${BANNER_NAME}`;

    for (const activity of app.activity || []) {
      for (const filter of activity["intent-filter"] || []) {
        const isLauncher = (filter.action || []).some((a) => a.$["android:name"] === "android.intent.action.MAIN");
        if (!isLauncher) continue;
        filter.category = filter.category || [];
        if (!filter.category.some((c) => c.$["android:name"] === "android.intent.category.LEANBACK_LAUNCHER")) {
          filter.category.push({ $: { "android:name": "android.intent.category.LEANBACK_LAUNCHER" } });
        }
      }
    }
    return cfg;
  });
}

function withTvBanner(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, "app/src/main/res/drawable-xhdpi");
      fs.mkdirSync(dir, { recursive: true });
      fs.copyFileSync(path.join(cfg.modRequest.projectRoot, BANNER_SOURCE), path.join(dir, `${BANNER_NAME}.png`));
      return cfg;
    },
  ]);
}

module.exports = function withAndroidTv(config) {
  return withTvBanner(withTvManifest(config));
};
