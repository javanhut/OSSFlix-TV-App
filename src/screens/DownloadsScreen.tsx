import { useMemo } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { Pressable } from "../components/FocusPressable";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { AppHeader } from "../components/AppHeader";
import { EmptyState } from "../components/EmptyState";
import { deleteDownload, pauseDownload, resumeDownload } from "../downloads/downloadManager";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useDownloadsStore } from "../state/downloads";
import { useSessionStore } from "../state/session";
import { colors } from "../theme/colors";
import type { DownloadItem } from "../types/downloads";

type TitleGroup = {
  dirPath: string;
  title: string;
  items: DownloadItem[];
};

function sortItems(items: DownloadItem[]): DownloadItem[] {
  return [...items].sort((a, b) => {
    const labelCmp = (a.episodeLabel ?? "").localeCompare(b.episodeLabel ?? "", undefined, { numeric: true });
    if (labelCmp !== 0) return labelCmp;
    return a.createdAt - b.createdAt;
  });
}

export function DownloadsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const items = useDownloadsStore((state) => state.items);
  const progress = useDownloadsStore((state) => state.progress);
  const profileId = useSessionStore((state) => state.profile?.id ?? null);

  const groups = useMemo<TitleGroup[]>(() => {
    const byDir = new Map<string, TitleGroup>();
    for (const item of Object.values(items)) {
      if (profileId != null && item.profileId != null && item.profileId !== profileId) continue;
      const group = byDir.get(item.dirPath);
      if (group) {
        group.items.push(item);
      } else {
        byDir.set(item.dirPath, {
          dirPath: item.dirPath,
          title: item.title,
          items: [item],
        });
      }
    }
    const result = [...byDir.values()];
    for (const group of result) group.items = sortItems(group.items);
    return result.sort((a, b) => a.title.localeCompare(b.title));
  }, [items, profileId]);

  const playOffline = (group: TitleGroup, item: DownloadItem) => {
    const completed = group.items.filter((entry) => entry.status === "completed" && entry.fileUri);
    const startIndex = Math.max(
      0,
      completed.findIndex((entry) => entry.id === item.id),
    );
    navigation.navigate("Player", {
      dirPath: group.dirPath,
      title: group.title,
      videos: completed.map((entry) => entry.fileUri as string),
      startIndex,
      initialTime: progress[item.id]?.current_time ?? 0,
      offline: true,
      offlineMeta: completed.map((entry) => ({
        id: entry.id,
        duration: entry.duration,
        timings: entry.timings ?? null,
        subtitles: entry.subtitles,
      })),
    });
  };

  const confirmDelete = (item: DownloadItem) => {
    Alert.alert("Remove download", `Delete "${item.episodeLabel || item.title}" from this device?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteDownload(item.id),
      },
    ]);
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <AppHeader title="Downloads" subtitle="Watch these titles without a connection to the server." />
      {groups.length === 0 ? (
        <EmptyState
          title="No downloads yet"
          subtitle="Tap the download icon on any episode or movie to save it here for offline viewing."
        />
      ) : (
        groups.map((group) => (
          <View key={group.dirPath} style={styles.group}>
            <Text style={styles.groupTitle} numberOfLines={1}>
              {group.title}
            </Text>
            {group.items.map((item) => (
              <DownloadRow
                key={item.id}
                item={item}
                resumeTime={progress[item.id]?.current_time ?? 0}
                onPlay={() => playOffline(group, item)}
                onDelete={() => confirmDelete(item)}
                onPause={() => void pauseDownload(item.id)}
                onResume={() => void resumeDownload(item.id)}
              />
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );
}

function DownloadRow({
  item,
  resumeTime,
  onPlay,
  onDelete,
  onPause,
  onResume,
}: {
  item: DownloadItem;
  resumeTime: number;
  onPlay: () => void;
  onDelete: () => void;
  onPause: () => void;
  onResume: () => void;
}) {
  const isCompleted = item.status === "completed";
  const isDownloading = item.status === "downloading";
  const indeterminate = item.progress < 0;
  const pct = Math.round(Math.max(0, Math.min(1, item.progress)) * 100);

  let statusLabel: string;
  if (isCompleted) statusLabel = resumeTime > 0 ? "Downloaded · Resume" : "Downloaded";
  else if (isDownloading) statusLabel = indeterminate ? "Downloading…" : `Downloading ${pct}%`;
  else if (item.status === "paused") statusLabel = "Paused";
  else if (item.status === "failed") statusLabel = "Failed — tap to retry";
  else statusLabel = "Queued";

  return (
    <View style={styles.row}>
      <Pressable
        style={styles.rowMain}
        onPress={isCompleted ? onPlay : item.status === "paused" || item.status === "failed" ? onResume : undefined}
        accessibilityRole="button"
        accessibilityLabel={isCompleted ? `Play ${item.episodeLabel || item.title}` : statusLabel}
      >
        {item.posterUri ? (
          <Image source={{ uri: item.posterUri }} style={styles.poster} />
        ) : (
          <View style={[styles.poster, styles.posterFallback]}>
            <Feather name="film" size={18} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.info}>
          <Text style={styles.label} numberOfLines={1}>
            {item.episodeLabel || item.title}
          </Text>
          <Text style={[styles.status, item.status === "failed" && styles.statusFailed]}>{statusLabel}</Text>
          {isDownloading && !indeterminate ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
          ) : null}
        </View>
        {isCompleted ? (
          <Feather name="play" size={18} color={colors.accentText} />
        ) : isDownloading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Feather name={item.status === "failed" ? "refresh-cw" : "play"} size={18} color={colors.textMuted} />
        )}
      </Pressable>
      <View style={styles.actions}>
        {isDownloading ? (
          <Pressable onPress={onPause} style={styles.actionButton} accessibilityLabel="Pause download">
            <Feather name="pause" size={16} color={colors.text} />
          </Pressable>
        ) : null}
        <Pressable onPress={onDelete} style={styles.actionButton} accessibilityLabel="Delete download">
          <Feather name="trash-2" size={16} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 18,
    paddingBottom: 32,
  },
  group: {
    marginBottom: 22,
  },
  groupTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 10,
    paddingRight: 8,
    overflow: "hidden",
  },
  rowMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  poster: {
    width: 64,
    height: 40,
    borderRadius: 8,
    backgroundColor: colors.surfaceAccent,
  },
  posterFallback: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  info: {
    flex: 1,
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  status: {
    marginTop: 4,
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  statusFailed: {
    color: "#f87171",
  },
  progressTrack: {
    marginTop: 8,
    height: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: colors.primary,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceAccent,
    alignItems: "center",
    justifyContent: "center",
  },
});
