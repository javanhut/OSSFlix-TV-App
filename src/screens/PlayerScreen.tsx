import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type LayoutChangeEvent, PanResponder, StyleSheet, Text, View } from "react-native";
import { Pressable } from "../components/FocusPressable";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ScreenOrientation from "expo-screen-orientation";
import { useQuery } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Video, { SelectedTrackType, TextTrackType } from "react-native-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../api/client";
import { saveOfflineProgress } from "../downloads/downloadManager";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useRemoteKeys } from "../native/remoteKeys";
import { getSystemMusicVolumeInfo, setPlayerVolumeStream, setSystemMusicVolume } from "../native/systemVolume";
import { colors } from "../theme/colors";
import { formatEpisodeLabel, parseEpisodePath } from "../utils/episodeNaming";
import { isTV, useTVPreferredFocus } from "../utils/tv";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

type GestureZone = "left" | "center" | "right";
type SkipFeedback = { text: string; key: number } | null;

const DOUBLE_TAP_MS = 280;
const SEEK_STEP = 10;
const VOLUME_ACTIVATION_DISTANCE = 12;
const VOLUME_HORIZONTAL_TOLERANCE = 10;
const VOLUME_TOUCH_ZONE_WIDTH = 1 / 3;
const VOLUME_TOUCH_PADDING = 16;
const COUNTDOWN_SECONDS = 10;
const COUNTDOWN_FALLBACK_BUFFER = 15;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function quantizeVolumeToSystemStep(volume: number, maxVolume: number): number {
  const bounded = clamp(volume, 0, 1);
  const steps = Math.max(1, maxVolume);
  return Math.round(bounded * steps) / steps;
}

function normalizeSubtitleLanguage(language: string): "en" | "es" | "fr" | "de" | "it" | "pt" | "ja" | "ko" | "zh" {
  const code = language.trim().toLowerCase().slice(0, 2);
  switch (code) {
    case "es":
    case "fr":
    case "de":
    case "it":
    case "pt":
    case "ja":
    case "ko":
    case "zh":
      return code;
    default:
      return "en";
  }
}

export function PlayerScreen({ route, navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { dirPath, title, videos, startIndex, initialTime, subtitles, offline, offlineMeta } = route.params;

  const playerRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volumeHudTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownCancelledRef = useRef(false);
  const lastAppliedSystemVolumeRef = useRef<number | null>(null);
  const volumeUpdateTokenRef = useRef(0);
  const lastTapRef = useRef<{ time: number; zone: GestureZone | null }>({
    time: 0,
    zone: null,
  });
  const gestureStartRef = useRef<{
    zone: GestureZone;
    volumeEligible: boolean;
    volumeActive: boolean;
  } | null>(null);
  const progressTrackRef = useRef<View>(null);
  const progressTrackPageXRef = useRef(0);
  const scrubTimeRef = useRef(initialTime);

  const [surfaceWidth, setSurfaceWidth] = useState(0);
  const [surfaceHeight, setSurfaceHeight] = useState(0);
  const [progressWidth, setProgressWidth] = useState(0);

  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [audioIndex, setAudioIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [pendingSeekTime, setPendingSeekTime] = useState(initialTime);
  const [selectedSubtitle, setSelectedSubtitle] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const playButtonRef = useRef<View>(null);
  // On TV, focus play/pause whenever the controls appear.
  useTVPreferredFocus(playButtonRef, showControls);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(initialTime);
  const [systemVolume, setSystemVolume] = useState(1);
  const [systemVolumeMax, setSystemVolumeMax] = useState(15);
  const [volumeHud, setVolumeHud] = useState<number | null>(null);
  const [skipFeedback, setSkipFeedback] = useState<SkipFeedback>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const currentVideo = videos[currentIndex];
  const currentOfflineMeta = offline ? offlineMeta?.[currentIndex] : undefined;
  const hasNext = currentIndex < videos.length - 1;
  const hasPrev = currentIndex > 0;
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const probeQuery = useQuery({
    queryKey: ["stream-probe", currentVideo],
    queryFn: () => api.getProbe(currentVideo),
    enabled: !offline,
  });
  const timingsQuery = useQuery({
    queryKey: ["episode-timings", currentVideo],
    queryFn: () => api.getTimings(currentVideo),
    enabled: !offline,
  });

  const timings = offline ? (currentOfflineMeta?.timings ?? null) : (timingsQuery.data ?? null);

  const subtitleTracks = useMemo(() => {
    if (offline) {
      return (currentOfflineMeta?.subtitles || []).map((track) => ({
        title: track.label,
        language: normalizeSubtitleLanguage(track.language),
        type: TextTrackType.VTT,
        uri: track.uri,
      }));
    }
    return (subtitles || []).map((track) => ({
      title: track.label,
      language: normalizeSubtitleLanguage(track.language),
      type: TextTrackType.VTT,
      uri: api.buildSubtitleUrl(track.src),
    }));
  }, [offline, currentOfflineMeta?.subtitles, subtitles]);

  const totalDuration = duration || (offline ? currentOfflineMeta?.duration : probeQuery.data?.duration) || 0;
  const displayTime = isScrubbing ? scrubTime : currentTime;
  const playedPercent = totalDuration > 0 ? clamp((displayTime / totalDuration) * 100, 0, 100) : 0;

  const persistProgress = useCallback(
    async (time: number, knownDuration: number) => {
      if (!currentVideo) return;
      if (offline) {
        const id = currentOfflineMeta?.id;
        if (!id) return;
        await saveOfflineProgress(id, {
          current_time: time,
          duration: knownDuration,
          updatedAt: Date.now(),
        }).catch(() => {});
        return;
      }
      await api
        .saveProgress({
          video_src: currentVideo,
          dir_path: dirPath,
          current_time: time,
          duration: knownDuration,
        })
        .catch(() => {});
    },
    [currentVideo, dirPath, offline, currentOfflineMeta?.id],
  );

  const clearMenus = useCallback(() => {
    setShowSpeedMenu(false);
  }, []);

  const hideVolumeHud = useCallback(() => {
    if (volumeHudTimeoutRef.current) clearTimeout(volumeHudTimeoutRef.current);
    setVolumeHud(null);
  }, []);

  const hideControlsSoon = useCallback(() => {
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (paused) return;
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls(false);
      clearMenus();
    }, 3200);
  }, [clearMenus, paused]);

  const showControlsTemporarily = useCallback(() => {
    setShowControls(true);
    hideControlsSoon();
  }, [hideControlsSoon]);

  const seekTo = useCallback(
    (time: number) => {
      const bounded = clamp(time, 0, totalDuration || time);
      playerRef.current?.seek(bounded);
      setCurrentTime(bounded);
      setScrubTime(bounded);
      setPendingSeekTime(0);
    },
    [totalDuration],
  );

  const showSkip = useCallback((text: string) => {
    setSkipFeedback({ text, key: Date.now() });
    setTimeout(() => {
      setSkipFeedback((current) => (current?.text === text ? null : current));
    }, 650);
  }, []);

  const skipBy = useCallback(
    (seconds: number) => {
      seekTo(displayTime + seconds);
      showSkip(seconds > 0 ? `+${seconds}s` : `${seconds}s`);
      showControlsTemporarily();
    },
    [displayTime, seekTo, showControlsTemporarily, showSkip],
  );

  const togglePlayPause = useCallback(() => {
    hideVolumeHud();
    setPaused((value) => !value);
    setShowControls(true);
  }, [hideVolumeHud]);

  const goToNext = useCallback(() => {
    if (!hasNext) return;
    setCurrentIndex((value) => value + 1);
    setCurrentTime(0);
    setScrubTime(0);
    setPendingSeekTime(0);
    setAudioIndex(0);
    setPaused(false);
    clearMenus();
  }, [clearMenus, hasNext]);

  const goToPrev = useCallback(() => {
    if (!hasPrev) return;
    setCurrentIndex((value) => value - 1);
    setCurrentTime(0);
    setScrubTime(0);
    setPendingSeekTime(0);
    setAudioIndex(0);
    setPaused(false);
    clearMenus();
  }, [clearMenus, hasPrev]);

  const nextEpisodeLabel = useMemo(() => {
    if (!hasNext) return null;
    const nextSrc = videos[currentIndex + 1];
    if (!nextSrc) return null;
    const parsed = parseEpisodePath(nextSrc);
    if (parsed) return formatEpisodeLabel(parsed);
    return nextSrc.split("/").pop() || nextSrc;
  }, [currentIndex, hasNext, videos]);

  const currentEpisodeLabel = useMemo(() => {
    if (!currentVideo) return null;
    const parsed = parseEpisodePath(currentVideo);
    if (!parsed) return null;
    return parsed.title ? `Episode ${parsed.episode}: ${parsed.title}` : `Episode ${parsed.episode}`;
  }, [currentVideo]);

  const cancelCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) return;
    setCountdown(COUNTDOWN_SECONDS);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          goToNext();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }, [goToNext]);

  const handleCountdownCancel = useCallback(() => {
    countdownCancelledRef.current = true;
    cancelCountdown();
  }, [cancelCountdown]);

  const handleCountdownPlayNow = useCallback(() => {
    cancelCountdown();
    goToNext();
  }, [cancelCountdown, goToNext]);

  useEffect(() => {
    if (currentIndex === startIndex) {
      setCurrentTime(initialTime);
      setPendingSeekTime(initialTime);
      setScrubTime(initialTime);
      return;
    }
    setCurrentTime(0);
    setPendingSeekTime(0);
    setScrubTime(0);
  }, [currentIndex, initialTime, startIndex]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // TVs are always landscape; forcing orientation there can letterbox the app.
      if (isTV) return;
      try {
        await ScreenOrientation.unlockAsync();
        if (cancelled) return;
        await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
      } catch {}
    })();
    setPlayerVolumeStream();
    void getSystemMusicVolumeInfo()
      .then(({ volume, maxVolume }) => {
        setSystemVolume(volume);
        setSystemVolumeMax(maxVolume);
        lastAppliedSystemVolumeRef.current = volume;
      })
      .catch(() => {});
    return () => {
      cancelled = true;
      if (!isTV) {
        void ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
      }
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      if (volumeHudTimeoutRef.current) clearTimeout(volumeHudTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void persistProgress(currentTime, totalDuration);
    }, 15000);
    return () => clearInterval(interval);
  }, [currentTime, persistProgress, totalDuration]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        void persistProgress(currentTime, totalDuration);
      }
    });
    return () => subscription.remove();
  }, [currentTime, persistProgress, totalDuration]);

  useEffect(() => {
    return () => {
      void persistProgress(currentTime, totalDuration);
    };
  }, [currentTime, persistProgress, totalDuration]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: currentVideo is the identity trigger that re-runs this reset when playback switches.
  useEffect(() => {
    setShowControls(true);
    hideControlsSoon();
    countdownCancelledRef.current = false;
    cancelCountdown();
  }, [currentVideo, hideControlsSoon, cancelCountdown]);

  useEffect(() => {
    const hasOutro = timings?.outro_start != null && timings?.outro_end != null;
    let trigger = -1;
    if (hasOutro) {
      trigger = timings.outro_start as number;
    } else if (totalDuration > COUNTDOWN_FALLBACK_BUFFER) {
      trigger = totalDuration - COUNTDOWN_FALLBACK_BUFFER;
    }
    if (!hasNext || trigger <= 0) {
      if (countdownIntervalRef.current) cancelCountdown();
      return;
    }
    const pastTrigger = currentTime >= trigger;
    if (pastTrigger && !countdownIntervalRef.current && !countdownCancelledRef.current) {
      startCountdown();
    } else if (!pastTrigger && countdownIntervalRef.current) {
      cancelCountdown();
    }
  }, [currentTime, totalDuration, timings, hasNext, startCountdown, cancelCountdown]);

  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (paused) {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
      setShowControls(true);
      return;
    }
    hideControlsSoon();
  }, [hideControlsSoon, paused]);

  const progressToTime = useCallback(
    (locationX: number) => {
      if (progressWidth <= 0 || totalDuration <= 0) return 0;
      const ratio = clamp(locationX / progressWidth, 0, 1);
      return ratio * totalDuration;
    },
    [progressWidth, totalDuration],
  );

  const handleProgressLayout = useCallback((event: LayoutChangeEvent) => {
    setProgressWidth(event.nativeEvent.layout.width);
    progressTrackRef.current?.measureInWindow((x) => {
      if (Number.isFinite(x)) progressTrackPageXRef.current = x;
    });
  }, []);

  const handleSurfaceLayout = useCallback((event: LayoutChangeEvent) => {
    setSurfaceWidth(event.nativeEvent.layout.width);
    setSurfaceHeight(event.nativeEvent.layout.height);
  }, []);

  const getZoneForX = useCallback(
    (x: number): GestureZone => {
      if (surfaceWidth <= 0) return "center";
      const third = surfaceWidth / 3;
      if (x < third) return "left";
      if (x > third * 2) return "right";
      return "center";
    },
    [surfaceWidth],
  );

  const isVolumeTouchZone = useCallback(
    (x: number) => {
      if (surfaceWidth <= 0) return false;
      return x >= surfaceWidth * (1 - VOLUME_TOUCH_ZONE_WIDTH);
    },
    [surfaceWidth],
  );

  const handleSingleTap = useCallback(() => {
    if (showControls) {
      setShowControls(false);
      clearMenus();
    } else {
      showControlsTemporarily();
    }
  }, [clearMenus, showControls, showControlsTemporarily]);

  const handleDoubleTap = useCallback(
    (zone: GestureZone) => {
      if (zone === "left") {
        skipBy(-SEEK_STEP);
        return;
      }
      if (zone === "right") {
        skipBy(SEEK_STEP);
        return;
      }
      togglePlayPause();
      showControlsTemporarily();
    },
    [showControlsTemporarily, skipBy, togglePlayPause],
  );

  // TV remote: media keys always work; with controls hidden, left/right seek quietly and
  // any other D-pad key brings the controls back (focused on play/pause).
  useRemoteKeys(({ key }) => {
    switch (key) {
      case "playPause":
        togglePlayPause();
        return;
      case "play":
        setPaused(false);
        showControlsTemporarily();
        return;
      case "pause":
        setPaused(true);
        return;
      case "fastForward":
        skipBy(SEEK_STEP);
        return;
      case "rewind":
        skipBy(-SEEK_STEP);
        return;
    }
    if (!showControls && (key === "left" || key === "right")) {
      const delta = key === "left" ? -SEEK_STEP : SEEK_STEP;
      seekTo(displayTime + delta);
      showSkip(delta > 0 ? `+${delta}s` : `${delta}s`);
      return;
    }
    // Navigating the visible controls keeps them up; any key wakes hidden ones.
    showControlsTemporarily();
  });

  const getGestureTouchY = useCallback(
    (event: { nativeEvent: { pageY?: number; locationY?: number } }, gestureState?: { moveY?: number }) => {
      if (gestureState?.moveY != null && Number.isFinite(gestureState.moveY)) {
        return gestureState.moveY;
      }
      if (event.nativeEvent.pageY != null && Number.isFinite(event.nativeEvent.pageY)) {
        return event.nativeEvent.pageY;
      }
      return event.nativeEvent.locationY ?? 0;
    },
    [],
  );

  const getVolumeForTouchY = useCallback(
    (touchY: number) => {
      const trackHeight = Math.max(surfaceHeight - VOLUME_TOUCH_PADDING * 2, 1);
      const normalizedY = clamp((touchY - VOLUME_TOUCH_PADDING) / trackHeight, 0, 1);
      return 1 - normalizedY;
    },
    [surfaceHeight],
  );

  const applySystemVolume = useCallback(
    (nextVolume: number) => {
      const clamped = quantizeVolumeToSystemStep(nextVolume, systemVolumeMax);
      if (
        lastAppliedSystemVolumeRef.current != null &&
        Math.abs(lastAppliedSystemVolumeRef.current - clamped) < 0.0001
      ) {
        setVolumeHud(clamped);
        return;
      }

      lastAppliedSystemVolumeRef.current = clamped;
      setSystemVolume(clamped);
      setVolumeHud(clamped);
      const token = volumeUpdateTokenRef.current + 1;
      volumeUpdateTokenRef.current = token;
      void setSystemMusicVolume(clamped)
        .then((appliedVolume) => {
          if (volumeUpdateTokenRef.current !== token) return;
          setSystemVolume(appliedVolume);
          setVolumeHud(appliedVolume);
          lastAppliedSystemVolumeRef.current = appliedVolume;
        })
        .catch(() => {});
    },
    [systemVolumeMax],
  );

  const gestureResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const { locationX } = event.nativeEvent;
          const volumeEligible = isVolumeTouchZone(locationX);
          gestureStartRef.current = {
            zone: getZoneForX(locationX),
            volumeEligible,
            volumeActive: false,
          };
        },
        onPanResponderMove: (event, gestureState) => {
          const state = gestureStartRef.current;
          if (!state?.volumeEligible || surfaceHeight <= 0) return;

          const verticalDistance = Math.abs(gestureState.dy);
          const horizontalDistance = Math.abs(gestureState.dx);
          if (!state.volumeActive) {
            if (verticalDistance < VOLUME_ACTIVATION_DISTANCE) return;
            if (verticalDistance <= horizontalDistance + VOLUME_HORIZONTAL_TOLERANCE) return;
          }

          state.volumeActive = true;
          const nextVolume = getVolumeForTouchY(getGestureTouchY(event, gestureState));
          applySystemVolume(nextVolume);
          setShowControls(true);
          if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
          if (volumeHudTimeoutRef.current) clearTimeout(volumeHudTimeoutRef.current);
        },
        onPanResponderRelease: (event, gestureState) => {
          const state = gestureStartRef.current;
          gestureStartRef.current = null;

          if (state?.volumeActive) {
            if (surfaceHeight > 0) {
              applySystemVolume(getVolumeForTouchY(getGestureTouchY(event, gestureState)));
            }
            volumeHudTimeoutRef.current = setTimeout(() => setVolumeHud(null), 700);
            showControlsTemporarily();
            return;
          }

          const now = Date.now();
          const lastTap = lastTapRef.current;
          if (lastTap.zone === state?.zone && now - lastTap.time < DOUBLE_TAP_MS) {
            if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
            lastTapRef.current = { time: 0, zone: null };
            handleDoubleTap(state?.zone || "center");
            return;
          }

          lastTapRef.current = { time: now, zone: state?.zone || "center" };
          if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
          tapTimeoutRef.current = setTimeout(() => {
            lastTapRef.current = { time: 0, zone: null };
            handleSingleTap();
          }, DOUBLE_TAP_MS);
        },
        onPanResponderTerminate: () => {
          gestureStartRef.current = null;
          if (volumeHudTimeoutRef.current) clearTimeout(volumeHudTimeoutRef.current);
          setVolumeHud(null);
        },
      }),
    [
      applySystemVolume,
      getGestureTouchY,
      getVolumeForTouchY,
      getZoneForX,
      handleDoubleTap,
      handleSingleTap,
      isVolumeTouchZone,
      showControlsTemporarily,
      surfaceHeight,
    ],
  );

  const progressResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
        onPanResponderGrant: (event, gestureState) => {
          progressTrackRef.current?.measureInWindow((x) => {
            if (Number.isFinite(x)) progressTrackPageXRef.current = x;
          });
          const pageX = gestureState.x0 || event.nativeEvent.pageX || 0;
          const relX = pageX - progressTrackPageXRef.current;
          const nextTime = progressToTime(relX);
          scrubTimeRef.current = nextTime;
          setIsScrubbing(true);
          setScrubTime(nextTime);
        },
        onPanResponderMove: (event, gestureState) => {
          const pageX = gestureState.moveX || event.nativeEvent.pageX || 0;
          const relX = pageX - progressTrackPageXRef.current;
          const nextTime = progressToTime(relX);
          scrubTimeRef.current = nextTime;
          setScrubTime(nextTime);
        },
        onPanResponderRelease: () => {
          setIsScrubbing(false);
          seekTo(scrubTimeRef.current);
          hideControlsSoon();
        },
        onPanResponderTerminate: () => {
          setIsScrubbing(false);
          hideControlsSoon();
        },
      }),
    [hideControlsSoon, progressToTime, seekTo],
  );

  const skipRange = useMemo(() => {
    if (!timings) return null;
    if (
      timings.intro_start != null &&
      timings.intro_end != null &&
      currentTime >= timings.intro_start &&
      currentTime <= timings.intro_end
    ) {
      return { label: "Skip Intro", target: timings.intro_end };
    }
    if (
      timings.outro_start != null &&
      timings.outro_end != null &&
      currentTime >= timings.outro_start &&
      currentTime <= timings.outro_end
    ) {
      return { label: "Skip Credits", target: timings.outro_end };
    }
    return null;
  }, [currentTime, timings]);

  return (
    <View testID="player-screen" style={styles.screen} onLayout={handleSurfaceLayout}>
      <Video
        ref={playerRef}
        source={
          offline
            ? { uri: currentVideo }
            : {
                uri: api.buildStreamUrl(currentVideo, audioIndex),
                headers: api.buildStreamHeaders(),
              }
        }
        textTracks={subtitleTracks}
        selectedTextTrack={
          selectedSubtitle != null
            ? { type: SelectedTrackType.INDEX, value: selectedSubtitle }
            : { type: SelectedTrackType.DISABLED }
        }
        controls={false}
        resizeMode="contain"
        style={styles.video}
        paused={paused}
        rate={playbackRate}
        volume={1}
        onLoad={(event) => {
          setDuration(event.duration);
          if (pendingSeekTime > 0) {
            playerRef.current?.seek(pendingSeekTime);
            setPendingSeekTime(0);
          }
          hideControlsSoon();
        }}
        onProgress={(event) => {
          if (!isScrubbing) setCurrentTime(event.currentTime);
        }}
        onEnd={() => {
          void persistProgress(totalDuration, totalDuration);
          if (hasNext) {
            goToNext();
            return;
          }
          navigation.goBack();
        }}
      />

      <View testID="gesture-surface" style={styles.gestureSurface} {...gestureResponder.panHandlers} />

      {skipFeedback ? (
        <View key={skipFeedback.key} style={styles.feedbackBubble}>
          <Text style={styles.feedbackText}>{skipFeedback.text}</Text>
        </View>
      ) : null}

      {volumeHud != null ? (
        <View style={styles.volumeHud}>
          <View style={styles.volumeTrack}>
            <View style={[styles.volumeFill, { height: `${volumeHud * 100}%` }]} />
          </View>
          <Text style={styles.volumeText}>{Math.round(volumeHud * 100)}%</Text>
        </View>
      ) : null}

      {countdown !== null ? (
        <View style={styles.countdownOverlay} pointerEvents="box-none">
          <View style={styles.countdownCard}>
            <Text style={styles.countdownEyebrow}>Up Next</Text>
            {nextEpisodeLabel ? (
              <Text style={styles.countdownTitle} numberOfLines={2}>
                {nextEpisodeLabel}
              </Text>
            ) : null}
            <Text style={styles.countdownNumber}>{countdown}</Text>
            <View style={styles.countdownButtons}>
              <Pressable onPress={handleCountdownCancel} style={styles.countdownCancel}>
                <Text style={styles.countdownCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleCountdownPlayNow} style={styles.countdownPlay}>
                <Feather name="play" size={14} color={colors.primaryText} />
                <Text style={styles.countdownPlayLabel}>Play Now</Text>
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {showControls ? (
        <>
          <LinearGradient
            colors={["rgba(0,0,0,0.78)", "rgba(0,0,0,0)"]}
            style={[styles.topBar, { paddingTop: Math.max(insets.top, 18) }]}
          >
            <Pressable onPress={() => navigation.goBack()} style={styles.iconButton}>
              <Feather name="arrow-left" size={22} color={colors.text} />
            </Pressable>
            <View style={styles.titleWrap}>
              <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
                {title}
              </Text>
            </View>
          </LinearGradient>

          <View style={styles.centerControls} pointerEvents="box-none">
            {hasPrev ? (
              <Pressable onPress={goToPrev} style={styles.iconButtonLarge}>
                <Feather name="skip-back" size={24} color={colors.text} />
              </Pressable>
            ) : (
              <View style={styles.sideSpacer} />
            )}

            <Pressable ref={playButtonRef} onPress={togglePlayPause} style={styles.playButton}>
              <Feather name={paused ? "play" : "pause"} size={30} color={colors.text} />
            </Pressable>

            {hasNext ? (
              <Pressable onPress={goToNext} style={styles.iconButtonLarge}>
                <Feather name="skip-forward" size={24} color={colors.text} />
              </Pressable>
            ) : (
              <View style={styles.sideSpacer} />
            )}
          </View>

          {skipRange ? (
            <Pressable onPress={() => seekTo(skipRange.target)} style={styles.skipButton}>
              <Text style={styles.skipLabel}>{skipRange.label}</Text>
            </Pressable>
          ) : null}

          <LinearGradient
            colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.82)"]}
            style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 18) }]}
          >
            <View style={styles.progressMeta}>
              <Text style={styles.timeLabel}>{formatTime(displayTime)}</Text>
              <Text style={styles.timeLabel}>{formatTime(totalDuration)}</Text>
            </View>

            <View
              ref={progressTrackRef}
              testID="progress-track"
              style={styles.progressTrack}
              hitSlop={{ top: 12, bottom: 12, left: 0, right: 0 }}
              onLayout={handleProgressLayout}
              {...progressResponder.panHandlers}
            >
              <View style={styles.progressTrackBg} />
              <View style={[styles.progressFill, { width: `${playedPercent}%` }]} />
              <View style={[styles.progressThumb, { left: `${playedPercent}%` }]} />
            </View>

            <View style={styles.controlsRow}>
              <View style={styles.controlsCluster}>
                <Pressable onPress={() => skipBy(-SEEK_STEP)} style={styles.iconButton}>
                  <Feather name="rotate-ccw" size={20} color={colors.text} />
                </Pressable>
                <Pressable onPress={() => skipBy(SEEK_STEP)} style={styles.iconButton}>
                  <Feather name="rotate-cw" size={20} color={colors.text} />
                </Pressable>
              </View>

              {currentEpisodeLabel ? (
                <Text style={styles.episodeLabel} numberOfLines={1} ellipsizeMode="tail">
                  {currentEpisodeLabel}
                </Text>
              ) : null}

              <View style={styles.controlsCluster}>
                <Pressable
                  onPress={() => {
                    seekTo(0);
                    showControlsTemporarily();
                  }}
                  style={styles.iconButton}
                >
                  <Feather name="refresh-cw" size={20} color={colors.text} />
                </Pressable>
                <Pressable
                  onPress={() => setShowSpeedMenu((value) => !value)}
                  style={[styles.iconButton, showSpeedMenu && styles.iconButtonActive]}
                >
                  <Feather name="settings" size={20} color={colors.text} />
                </Pressable>
              </View>
            </View>

            {showSpeedMenu ? (
              <View style={styles.menuSheet}>
                {speeds.map((speed) => (
                  <Pressable
                    key={speed}
                    onPress={() => {
                      setPlaybackRate(speed);
                      setShowSpeedMenu(false);
                      hideControlsSoon();
                    }}
                    style={[styles.menuItem, playbackRate === speed && styles.menuItemActive]}
                  >
                    <Text style={styles.menuLabel}>{speed === 1 ? "Normal" : `${speed}x`}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </LinearGradient>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  video: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000",
  },
  gestureSurface: {
    ...StyleSheet.absoluteFill,
    zIndex: 5,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  episodeLabel: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.2,
    textAlign: "center",
    marginHorizontal: 12,
  },
  centerControls: {
    position: "absolute",
    inset: 0,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
  },
  sideSpacer: {
    width: 54,
    height: 54,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonLarge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonActive: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAccent,
  },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20,
    paddingHorizontal: 18,
    paddingTop: 28,
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  timeLabel: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  progressTrack: {
    height: 24,
    justifyContent: "center",
  },
  progressTrackBg: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 5,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  progressFill: {
    height: 5,
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  progressThumb: {
    position: "absolute",
    top: 4,
    marginLeft: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ffffff",
  },
  controlsRow: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  controlsCluster: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  skipButton: {
    position: "absolute",
    right: 20,
    bottom: 122,
    zIndex: 22,
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  skipLabel: {
    color: colors.primaryText,
    fontWeight: "700",
  },
  menuSheet: {
    marginTop: 14,
    backgroundColor: "rgba(10,15,28,0.96)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    gap: 6,
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "transparent",
  },
  menuItemActive: {
    backgroundColor: colors.surfaceAccent,
  },
  menuLabel: {
    color: colors.text,
    fontWeight: "700",
  },
  feedbackBubble: {
    position: "absolute",
    top: "46%",
    alignSelf: "center",
    zIndex: 30,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "rgba(15,23,42,0.92)",
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  feedbackText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  volumeHud: {
    position: "absolute",
    right: 24,
    top: "28%",
    zIndex: 30,
    alignItems: "center",
    gap: 10,
  },
  volumeTrack: {
    width: 36,
    height: 160,
    borderRadius: 18,
    overflow: "hidden",
    justifyContent: "flex-end",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  volumeFill: {
    width: "100%",
    backgroundColor: colors.primary,
  },
  volumeText: {
    color: colors.text,
    fontWeight: "800",
  },
  countdownOverlay: {
    position: "absolute",
    right: 20,
    bottom: 140,
    zIndex: 25,
  },
  countdownCard: {
    minWidth: 240,
    maxWidth: 320,
    backgroundColor: "rgba(20,20,28,0.94)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  countdownEyebrow: {
    color: colors.accentText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  countdownTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginTop: 6,
  },
  countdownNumber: {
    color: colors.text,
    fontSize: 36,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    marginTop: 8,
  },
  countdownButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  countdownCancel: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  countdownCancelLabel: {
    color: colors.text,
    fontWeight: "700",
  },
  countdownPlay: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: colors.primary,
  },
  countdownPlayLabel: {
    color: colors.primaryText,
    fontWeight: "700",
  },
});
