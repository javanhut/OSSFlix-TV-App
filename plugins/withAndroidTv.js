/*
 * Android TV setup for `expo prebuild`:
 *  - TV launcher only (LEANBACK_LAUNCHER replaces the phone LAUNCHER) with a 320x180 banner
 *  - requires the leanback UI (TV-only install) and doesn't require a touchscreen
 * The checked-in android/ already has these changes; this keeps them on a regenerate.
 */
const fs = require("node:fs");
const path = require("node:path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const BANNER_SOURCE = "assets/tv-banner.png";
const BANNER_NAME = "tv_banner";

function setUsesFeature(manifest, name, required) {
  manifest["uses-feature"] = (manifest["uses-feature"] || []).filter((f) => f.$["android:name"] !== name);
  manifest["uses-feature"].push({ $: { "android:name": name, "android:required": String(required) } });
}

function withTvManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    setUsesFeature(manifest, "android.hardware.touchscreen", false);
    setUsesFeature(manifest, "android.software.leanback", true);

    const app = manifest.application[0];
    app.$["android:banner"] = `@drawable/${BANNER_NAME}`;

    for (const activity of app.activity || []) {
      for (const filter of activity["intent-filter"] || []) {
        const isLauncher = (filter.action || []).some((a) => a.$["android:name"] === "android.intent.action.MAIN");
        if (!isLauncher) continue;
        filter.category = (filter.category || []).filter(
          (c) => c.$["android:name"] !== "android.intent.category.LAUNCHER",
        );
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
