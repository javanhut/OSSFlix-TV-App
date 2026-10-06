# OSSFlix Mobile App

Android-first React Native client for Reelscape.

## Scope

- Connect to a Reelscape server by URL
- Discover profiles by email or unclaimed profile lookup
- Sign in with the new mobile bearer-token auth flow
- Browse Home, Movies, TV Shows, Search, and My List
- Open title details, play content, resume progress, switch audio tracks, and enable subtitles

## Setup

Requirements: Bun, Node 20.19+, **JDK 17** (Gradle can't run on newer JDKs), and the Android SDK with
`ANDROID_HOME` set (e.g. `~/Android/Sdk`) and `platform-tools` on your `PATH`.

```bash
cd OSSFlix-Mobile-App
bun install
bun run android   # builds the native app, installs it on the emulator/device, starts Metro
```

After the first install, `bun run start` is enough for JS-only changes. Rebuild with `bun run android`
whenever native code or native dependencies change.

This app ships native modules (`react-native-video`, the `SystemVolume` module in `android/`), so it
does **not** run in Expo Go — use the development build above.

The `android/` directory is checked in because of custom native code. If you regenerate it with
`expo prebuild --clean`, restore:

- `SystemVolumeModule.kt` / `SystemVolumePackage.kt` and the `add(SystemVolumePackage())` line in `MainApplication.kt`
- `RemoteKeyEmitter.kt` and the `dispatchKeyEvent` override in `MainActivity.kt` (TV remote keys)

The TV manifest entries and banner are re-applied automatically by `plugins/withAndroidTv.js`.

Releases: pushing a `vX.Y.Z` tag runs `.github/workflows/release-android.yml`, which scans, typechecks,
tests, builds the release APK and publishes it as a GitHub release.

The server must include the mobile auth endpoints added in `OSSFlix`.

## Android TV

The same APK runs on phones and Android TV / Google TV. It appears in the TV launcher with
`assets/tv-banner.png`, and everything is reachable with the D-pad: focused buttons and posters get a
white ring, and the Home screen's browse links (Movies, TV Shows, Anime, My List, For You) replace the
phone's swipe-in sidebar. In the player, OK shows the controls, left/right seek 10s while the controls are
hidden, and play/pause, fast-forward and rewind media keys work at any time.

To try it, create an Android TV or Google TV device in Android Studio's Device Manager and run
`bun run android` with it as the only running emulator.

## Notes

- The app assumes the server exposes `/api/mobile/server-info`.
- Streaming requests send `Authorization: Bearer <token>` headers.
- `react-native-video` is used for Android playback and receives stream/subtitle URLs directly from the server.
