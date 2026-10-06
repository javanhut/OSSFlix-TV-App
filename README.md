# OSSFlix TV App

Android TV / Google TV client for Reelscape. The phone app lives in `OSSFlix-Mobile-App`.

## Scope

- Connect to a Reelscape server by URL
- Discover profiles by email or unclaimed profile lookup
- Sign in with the mobile bearer-token auth flow
- Browse Home, Movies, TV Shows, Anime, Search, My List and For You
- Open title details, play content, resume progress, switch audio tracks, and enable subtitles

## Using it with a remote

- The app appears in the TV launcher with `assets/tv-banner.png`.
- Everything is reached with the D-pad: the focused button or poster gets a white ring, and the
  tab rail on the left holds Home, Search, Explore, Downloads and Profile. Movies, TV Shows,
  Anime, My List and For You are the links under the Home hero.
- In the player, OK shows the controls (focused on play/pause), left/right seek 10s while the
  controls are hidden, and the play/pause, fast-forward and rewind media keys work at any time.
  Volume is the remote's own volume keys.

## Setup

Requirements: Bun, Node 20.19+, **JDK 17** (Gradle can't run on newer JDKs), and the Android SDK with
`ANDROID_HOME` set (e.g. `~/Android/Sdk`) and `platform-tools` on your `PATH`.

Create an Android TV or Google TV emulator in Android Studio's Device Manager (or connect a TV with
ADB debugging on), then:

```bash
cd OSSFlix-TV-App
bun install
bun run android   # builds the native app, installs it on the TV, starts Metro
```

After the first install, `bun run start` is enough for JS-only changes. Rebuild with `bun run android`
whenever native code or native dependencies change.

The manifest requires the TV (leanback) UI, so the APK only installs on TVs. It ships native modules
(`react-native-video`, the `SystemVolume` and `RemoteKeyEmitter` code in `android/`), so it does **not**
run in Expo Go.

The `android/` directory is checked in because of custom native code. If you regenerate it with
`expo prebuild --clean`, restore:

- `SystemVolumeModule.kt` / `SystemVolumePackage.kt` and the `add(SystemVolumePackage())` line in `MainApplication.kt`
- `RemoteKeyEmitter.kt` and the `dispatchKeyEvent` override in `MainActivity.kt` (remote keys)

The TV manifest entries and banner are re-applied automatically by `plugins/withAndroidTv.js`.

The server must include the mobile auth endpoints added in `OSSFlix`.

## Notes

- The app assumes the server exposes `/api/mobile/server-info`.
- Streaming requests send `Authorization: Bearer <token>` headers.
- `react-native-video` is used for playback and receives stream/subtitle URLs directly from the server.
