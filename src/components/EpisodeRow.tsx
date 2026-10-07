import { useState } from "react";
import { ActivityIndicator, type StyleProp, StyleSheet, Text, View, type ViewStyle } from "react-native";
import { Pressable } from "./FocusPressable";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { ParsedEpisode } from "../utils/episodeNaming";
import type { DownloadStatus } from "../types/downloads";
import { isProgressInProgress, isProgressWatched } from "../utils/progress";

export type EpisodeRowProgress = {
  current_time: number;
  duration: number;
};

function DownloadControl({
  status,
  progress,
  onDownload,
  onDeleteDownload,
}: {
  status?: DownloadStatus;
  progress?: number;
  onDownload?: () => void;
  onDeleteDownload?: () => void;
}) {
  if (status === "downloading" || status === "queued") {
    const pct = typeof progress === "number" && progress >= 0 ? `${Math.round(progress * 100)}%` : null;
    return (
      <View style={[styles.action, styles.actionWide]} accessibilityLabel="Downloading">
        <ActivityIndicator size="small" color={colors.accentText} />
        {pct ? <Text style={styles.downloadPct}>{pct}</Text> : null}
      </View>
    );
  }
  if (status === "completed") {
    return (
      <Pressable onPress={onDeleteDownload} style={styles.action} accessibilityLabel="Remove download">
        <Feather name="check-circle" size={20} color={colors.green} />
      </Pressable>
    );
  }
  const retry = status === "paused" || status === "failed";
  return (
    <Pressable
      onPress={onDownload}
      style={styles.action}
      accessibilityLabel={retry ? "Retry download" : "Download for offline"}
    >
      <Feather name={retry ? "refresh-cw" : "download"} size={20} color={colors.text} />
    </Pressable>
  );
}

function formatTime(secs: number): string {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  const mm = m.toString().padStart(2, "0");
  const ss = s.toString().padStart(2, "0");
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${m}:${ss}`;
}

function formatRemaining(secs: number): string {
  const minutes = Math.max(1, Math.round(secs / 60));
  if (minutes < 60) return `${minutes} min left`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} hr ${m} min left` : `${h} hr left`;
}

const TILE_GRADIENTS = {
  inProgress: ["#3b82f6", "#1d4ed8"],
  watched: ["#22c55e", "#15803d"],
  unwatched: ["#334155", "#1e293b"],
} as const;

/**
 * One episode in the details list, laid out for a TV: the whole row is the play target and glows
 * when the remote is on it; restart and download sit to the right as their own D-pad stops.
 */
export function EpisodeRow({
  parsed,
  fallbackLabel,
  progress,
  onPlay,
  onRestart,
  downloadStatus,
  downloadProgress,
  onDownload,
  onDeleteDownload,
  style,
  onFocus,
}: {
  parsed: ParsedEpisode | null;
  fallbackLabel: string;
  progress?: EpisodeRowProgress | null;
  onPlay: () => void;
  onRestart?: () => void;
  downloadStatus?: DownloadStatus;
  downloadProgress?: number;
  onDownload?: () => void;
  onDeleteDownload?: () => void;
  style?: StyleProp<ViewStyle>;
  /** The row's play target got D-pad focus (the list glides it into place). */
  onFocus?: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const isInProgress = isProgressInProgress(progress);
  const isWatched = isProgressWatched(progress);
  const pct = progress && progress.duration > 0 ? Math.min(100, (progress.current_time / progress.duration) * 100) : 0;

  // Titled episodes put "Episode N" above the title; untitled ones use it as the title.
  const eyebrow = parsed ? (parsed.title ? `Episode ${parsed.episode}` : `Season ${parsed.season}`) : "Movie";
  const tileColors = isWatched
    ? TILE_GRADIENTS.watched
    : isInProgress
      ? TILE_GRADIENTS.inProgress
      : TILE_GRADIENTS.unwatched;
  const titleText = parsed ? parsed.title || `Episode ${parsed.episode}` : fallbackLabel;

  let metaText: string | null = null;
  if (progress && progress.duration > 0) {
    if (isInProgress) {
      metaText = `${formatTime(progress.current_time)} / ${formatTime(progress.duration)} · ${formatRemaining(
        progress.duration - progress.current_time,
      )}`;
    } else if (isWatched) {
      metaText = `Watched · ${formatTime(progress.duration)}`;
    } else {
      metaText = formatTime(progress.duration);
    }
  }

  return (
    <View testID="episode-row" style={[styles.card, focused && styles.cardFocused, style]}>
      <Pressable
        onPress={onPlay}
        onFocus={() => {
          setFocused(true);
          onFocus?.();
        }}
        onBlur={() => setFocused(false)}
        style={styles.main}
        focusStyle={styles.mainFocused}
        accessibilityRole="button"
        accessibilityLabel={parsed ? `Play Episode ${parsed.episode}` : `Play ${titleText}`}
      >
        <View style={styles.tileWrap}>
          <LinearGradient
            colors={tileColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.tile, !isWatched && !isInProgress && styles.tileUnwatched]}
          >
            {parsed ? (
              <Text style={[styles.tileNumber, !isWatched && !isInProgress && styles.tileNumberUnwatched]}>
                {parsed.episode}
              </Text>
            ) : (
              <Feather name="film" size={22} color={colors.text} />
            )}
          </LinearGradient>
          {isWatched ? (
            <View style={styles.watchedBadge}>
              <Feather name="check" size={12} color={colors.primaryText} />
            </View>
          ) : null}
        </View>
        <View style={styles.info}>
          <Text style={styles.eyebrow} numberOfLines={1}>
            {eyebrow}
          </Text>
          <Text style={styles.title} numberOfLines={1}>
            {titleText}
          </Text>
          {metaText ? (
            <Text style={styles.meta} numberOfLines={1}>
              {metaText}
            </Text>
          ) : null}
          {(isInProgress && pct > 0) || isWatched ? (
            <View style={styles.progressTrack} pointerEvents="none">
              <View
                style={[
                  styles.progressFill,
                  { width: isWatched ? "100%" : `${pct}%` },
                  isWatched && styles.progressFillWatched,
                ]}
              />
            </View>
          ) : null}
        </View>
      </Pressable>
      <View style={styles.actions}>
        {isInProgress && onRestart ? (
          <Pressable
            onPress={onRestart}
            style={styles.action}
            accessibilityRole="button"
            accessibilityLabel="Play from beginning"
          >
            <Feather name="rotate-ccw" size={20} color={colors.text} />
          </Pressable>
        ) : null}
        {onDownload || downloadStatus ? (
          <DownloadControl
            status={downloadStatus}
            progress={downloadProgress}
            onDownload={onDownload}
            onDeleteDownload={onDeleteDownload}
          />
        ) : null}
      </View>
    </View>
  );
}

const TILE = 56;

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 76,
    paddingRight: 14,
    borderRadius: 16,
    backgroundColor: "rgba(9,18,42,0.82)",
    // Always 2px so focusing doesn't shift the layout; only the color changes.
    borderWidth: 2,
    borderColor: "rgba(96,165,250,0.14)",
  },
  // Crisp bright border plus a tight glow, so the focused row reads sharply from across the room.
  cardFocused: {
    backgroundColor: "rgba(23,52,130,0.9)",
    borderColor: "#60a5fa",
    boxShadow: "0 0 18px 3px rgba(59,130,246,0.55)",
  },
  main: {
    flex: 1,
    alignSelf: "stretch",
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    paddingVertical: 8,
    paddingLeft: 12,
  },
  // The whole card shows focus, so drop the default outline ring on the play target.
  mainFocused: {
    outlineWidth: 0,
  },
  tileWrap: {
    width: TILE,
    height: TILE,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  tileUnwatched: {
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.3)",
  },
  tileNumber: {
    color: "#ffffff",
    fontFamily: fonts.displayBold,
    fontSize: 26,
    letterSpacing: -0.5,
  },
  tileNumberUnwatched: {
    color: colors.textSoft,
  },
  watchedBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.green,
    borderWidth: 2,
    borderColor: "#ffffff",
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    color: colors.accentText,
    fontFamily: fonts.bodyBold,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: "uppercase",
  },
  title: {
    marginTop: 1,
    color: "#ffffff",
    fontFamily: fonts.displayBold,
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  meta: {
    marginTop: 2,
    color: colors.textSoft,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  progressTrack: {
    marginTop: 7,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
    backgroundColor: "rgba(148,163,184,0.25)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
    backgroundColor: colors.accentText,
  },
  progressFillWatched: {
    backgroundColor: colors.green,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  action: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(4,9,24,0.8)",
    borderWidth: 1.5,
    borderColor: "rgba(96,165,250,0.35)",
  },
  actionWide: {
    width: undefined,
    minWidth: 48,
    paddingHorizontal: 12,
    flexDirection: "row",
    gap: 6,
  },
  downloadPct: {
    color: colors.accentText,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
  },
});
