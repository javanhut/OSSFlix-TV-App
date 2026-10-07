import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, PixelRatio, StyleSheet, Text, View } from "react-native";
import { Pressable } from "../components/FocusPressable";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import Video, { SelectedTrackType, TextTrackType } from "react-native-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "../api/client";
import { saveOfflineProgress } from "../downloads/downloadManager";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useRemoteKeys } from "../native/remoteKeys";
import { setPlayerVolumeStream } from "../native/systemVolume";
import { colors } from "../theme/colors";
import { formatEpisodeLabel, parseEpisodePath } from "../utils/episodeNaming";
import { useTVPreferredFocus } from "../utils/tv";

type Props = NativeStackScreenProps<RootStackParamList, "Player">;

type SkipFeedback = { text: string; key: number } | null;

const SEEK_STEP = 10;
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
  const queryClient = useQueryClient();
  const { dirPath, title, videos, startIndex, initialTime, subtitles, offline, offlineMeta } = route.params;

  const playerRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownCancelledRef = useRef(false);
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [audioIndex, setAudioIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(initialTime);
  const [duration, setDuration] = useState(0);
  const [pendingSeekTime, setPendingSeekTime] = useState(initialTime);
  const [selectedSubtitle, setSelectedSubtitle] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const [showControls, setShowControls] = useState(true);
  // Put the remote on play/pause whenever the controls appear.
  const playButtonPreferredFocus = useTVPreferredFocus(showControls);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [skipFeedback, setSkipFeedback] = useState<SkipFeedback>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [bottomBarHeight, setBottomBarHeight] = useState(0);

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
  const displayTime = currentTime;
  const playedPercent = totalDuration > 0 ? clamp((displayTime / totalDuration) * 100, 0, 100) : 0;

  // Latest position for the save paths, so they don't re-run on every progress tick. Updated after
  // each commit, so an episode-switch cleanup still sees the outgoing episode's position.
  const positionRef = useRef({ time: initialTime, duration: 0 });
  useEffect(() => {
    positionRef.current = { time: currentTime, duration: totalDuration };
  });
  // Set when playback rolls into the next episode (or ends), so the outgoing one saves as finished.
  const finishedRef = useRef(false);

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
    setPaused((value) => !value);
    setShowControls(true);
  }, []);

  const goToNext = useCallback(() => {
    if (!hasNext) return;
    setCurrentIndex((value) => value + 1);
    setCurrentTime(0);
    setPendingSeekTime(0);
    setAudioIndex(0);
    setPaused(false);
    clearMenus();
  }, [clearMenus, hasNext]);

  const goToPrev = useCallback(() => {
    if (!hasPrev) return;
    setCurrentIndex((value) => value - 1);
    setCurrentTime(0);
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

  const finishAndAdvance = useCallback(() => {
    finishedRef.current = true;
    goToNext();
  }, [goToNext]);

  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) return;
    setCountdown(COUNTDOWN_SECONDS);
    countdownIntervalRef.current = setInterval(() => {
      setCountdown((prev) => (prev === null ? null : prev - 1));
    }, 1000);
  }, []);

  useEffect(() => {
    if (countdown === null || countdown > 0) return;
    cancelCountdown();
    finishAndAdvance();
  }, [countdown, cancelCountdown, finishAndAdvance]);

  const handleCountdownCancel = useCallback(() => {
    countdownCancelledRef.current = true;
    cancelCountdown();
  }, [cancelCountdown]);

  const handleCountdownPlayNow = useCallback(() => {
    cancelCountdown();
    finishAndAdvance();
  }, [cancelCountdown, finishAndAdvance]);

  useEffect(() => {
    if (currentIndex === startIndex) {
      setCurrentTime(initialTime);
      setPendingSeekTime(initialTime);
      return;
    }
    setCurrentTime(0);
    setPendingSeekTime(0);
  }, [currentIndex, initialTime, startIndex]);

  useEffect(() => {
    // Remote volume keys adjust the media stream while the player is open.
    setPlayerVolumeStream();
    return () => {
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      void persistProgress(positionRef.current.time, positionRef.current.duration);
    }, 15000);
    return () => clearInterval(interval);
  }, [persistProgress]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") {
        void persistProgress(positionRef.current.time, positionRef.current.duration);
      }
    });
    return () => subscription.remove();
  }, [persistProgress]);

  // Leaving an episode (switching or closing the player): save where it stopped, then refresh the
  // screens behind the player so their progress isn't stale.
  useEffect(() => {
    return () => {
      const { time, duration } = positionRef.current;
      const finished = finishedRef.current && duration > 0;
      finishedRef.current = false;
      void persistProgress(finished ? duration : time, duration).then(() => {
        void queryClient.invalidateQueries({ queryKey: ["progress-dir", dirPath] });
        void queryClient.invalidateQueries({ queryKey: ["continue-watching"] });
      });
    };
  }, [dirPath, persistProgress, queryClient]);

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
    <View testID="player-screen" style={styles.screen}>
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
        // Lift subtitles above the controls bar while it's showing (the native padding is in px).
        subtitleStyle={{
          paddingBottom: showControls ? PixelRatio.getPixelSizeForLayoutSize(bottomBarHeight) : 0,
        }}
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
          setCurrentTime(event.currentTime);
        }}
        onEnd={() => {
          if (hasNext) {
            finishAndAdvance();
            return;
          }
          finishedRef.current = true;
          navigation.goBack();
        }}
      />

      {skipFeedback ? (
        <View key={skipFeedback.key} style={styles.feedbackBubble}>
          <Text style={styles.feedbackText}>{skipFeedback.text}</Text>
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

            <Pressable
              hasTVPreferredFocus={playButtonPreferredFocus}
              onPress={togglePlayPause}
              style={styles.playButton}
            >
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
            onLayout={(event) => setBottomBarHeight(event.nativeEvent.layout.height)}
          >
            <View style={styles.progressMeta}>
              <Text style={styles.timeLabel}>{formatTime(displayTime)}</Text>
              <Text style={styles.timeLabel}>{formatTime(totalDuration)}</Text>
            </View>

            <View testID="progress-track" style={styles.progressTrack}>
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
    // Mostly opaque: a see-through fill lets bright video detail look like marks beside the icon.
    backgroundColor: "rgba(10,15,28,0.72)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonLarge: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: "rgba(10,15,28,0.72)",
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
