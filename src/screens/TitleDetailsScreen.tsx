import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Pressable } from "../components/FocusPressable";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Feather, Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api, resolveAssetUrl } from "../api/client";
import { GlassButton, PlayButton } from "../components/Buttons";
import { EmptyState } from "../components/EmptyState";
import { EpisodeRow } from "../components/EpisodeRow";
import { TvBanner } from "../components/TvBanner";
import { deleteDownload, makeDownloadId, startDownload } from "../downloads/downloadManager";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useDownloadsStore } from "../state/downloads";
import { useSessionStore } from "../state/session";
import { colors } from "../theme/colors";
import { focusGlow } from "../theme/focus";
import { fonts } from "../theme/typography";
import {
  type AudioVariant,
  compareVideoSrc,
  formatEpisodeLabel,
  inferEpisodeVariants,
  parseEpisodePath,
  titleFromStem,
  type ParsedEpisode,
} from "../utils/episodeNaming";
import { isProgressInProgress, isProgressWatched } from "../utils/progress";

type AudioSelection = AudioVariant | "both";
import { formatTitleType } from "../utils/titleType";

type Props = NativeStackScreenProps<RootStackParamList, "TitleDetails">;

// On a TV (landscape) the episode list scrolls under a fixed header, sized to show this many rows.
const EPISODES_PER_VIEW = 4;
const EPISODE_GAP = 10;
// Room above/below the list so the focused row's glow isn't clipped by the scroller.
const EPISODE_LIST_INSET = 16;
const MIN_EPISODE_ROW_HEIGHT = 72;
const EPISODE_FOCUS_SLOT = 1;

// TV page: a deep navy gradient under a full-width banner that fades into it.
// Near-black base; the blue comes from TV_BLUE_WASH on top of it.
const TV_PAGE_GRADIENT = ["#050914", "#02040a", "#000000"] as const;
// Navy rising from the bottom-left (behind the actions); it fades out by about half-height, below
// the visible banner art, so it doesn't tint the artwork.
const TV_BLUE_WASH = ["rgba(16,36,90,0.75)", "rgba(12,28,70,0.4)", "rgba(12,28,70,0)"] as const;
const TV_PAGE_GRADIENT_STOPS = [0, 0.6, 1] as const;
const TV_BANNER_FRACTION = 0.6; // ends where the page gradient is TV_PAGE_GRADIENT[1]
// The episode list starts this far down, leaving the top of the banner clear.
const TV_EPISODES_TOP_FRACTION = 0.15;

type EpisodeEntry = {
  video: string;
  parsed: ParsedEpisode | null;
  label: string;
};

function toRelative(video: string, dirPath: string): string {
  if (!dirPath) return video;
  const prefix = dirPath.endsWith("/") ? dirPath : `${dirPath}/`;
  if (video.startsWith(prefix)) return video.slice(prefix.length);
  const idx = video.indexOf(dirPath);
  if (idx >= 0) return video.slice(idx + prefix.length);
  return video;
}

function buildEntry(video: string, dirPath: string): EpisodeEntry {
  const rel = toRelative(video, dirPath);
  const parsed = parseEpisodePath(rel);
  if (parsed) {
    return { video, parsed, label: formatEpisodeLabel(parsed) };
  }
  const fileName = video.split("/").pop() || video;
  const stem = fileName.replace(/\.[^/.]+$/, "");
  const fallback = titleFromStem(stem) || fileName;
  return { video, parsed: null, label: fallback };
}

export function TitleDetailsScreen({ route, navigation }: Props) {
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const insets = useSafeAreaInsets();

  const queryClient = useQueryClient();
  const { dirPath, autoplay } = route.params;
  const detailsQuery = useQuery({
    queryKey: ["title-details", dirPath],
    queryFn: () => api.getTitleDetails(dirPath),
  });
  const watchlistQuery = useQuery({
    queryKey: ["watchlist-check", dirPath],
    queryFn: () => api.watchlistCheck(dirPath),
  });
  const progressQuery = useQuery({
    queryKey: ["progress-dir", dirPath],
    queryFn: () => api.getProgressForDir(dirPath),
  });

  const toggleWatchlist = useMutation({
    mutationFn: async () => {
      if (watchlistQuery.data?.inList) {
        return api.removeFromWatchlist(dirPath);
      }
      return api.addToWatchlist(dirPath);
    },
    onMutate: async () => {
      const checkKey = ["watchlist-check", dirPath];
      await queryClient.cancelQueries({ queryKey: checkKey });
      const previous = queryClient.getQueryData<{ inList: boolean }>(checkKey);
      queryClient.setQueryData(checkKey, { inList: !previous?.inList });
      return { previous };
    },
    onError: (error, _vars, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(["watchlist-check", dirPath], context.previous);
      }
      Alert.alert("Unable to update My List", error instanceof Error ? error.message : "Request failed.");
    },
    onSettled: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
        queryClient.invalidateQueries({
          queryKey: ["watchlist-check", dirPath],
        }),
      ]);
    },
  });

  const details = detailsQuery.data;

  const downloadItems = useDownloadsStore((state) => state.items);
  const profileId = useSessionStore((state) => state.profile?.id ?? null);

  const variantMap = useMemo(() => inferEpisodeVariants(details?.videos || []), [details?.videos]);
  const availableVariants = useMemo(() => {
    const set = new Set<AudioVariant>();
    for (const v of variantMap.values()) {
      if (v) set.add(v);
    }
    return set;
  }, [variantMap]);
  const hasBothVariants = availableVariants.has("sub") && availableVariants.has("dub");

  const [selectedVariant, setSelectedVariant] = useState<AudioSelection | null>(null);

  useEffect(() => {
    if (hasBothVariants && selectedVariant === null) {
      setSelectedVariant("sub");
    } else if (!hasBothVariants && selectedVariant !== null) {
      setSelectedVariant(null);
    }
  }, [hasBothVariants, selectedVariant]);

  const filteredVideos = useMemo(() => {
    const videos = details?.videos || [];
    if (selectedVariant === "both" || !hasBothVariants || selectedVariant === null) {
      return videos;
    }
    const variantFiltered = videos.filter((v) => {
      const variant = variantMap.get(v) ?? null;
      return variant === null || variant === selectedVariant;
    });
    const pickRank = (src: string): number => {
      const v = variantMap.get(src) ?? null;
      if (v === selectedVariant) return 0;
      if (v === null) return 1;
      return 2;
    };
    const groups = new Map<string, string[]>();
    for (const src of variantFiltered) {
      const filename = src.split("/").pop() || src;
      const parsed = parseEpisodePath(filename);
      if (!parsed) continue;
      const key = `s${parsed.season}e${parsed.episode}`;
      const list = groups.get(key);
      if (list) list.push(src);
      else groups.set(key, [src]);
    }
    const winnerByKey = new Map<string, string>();
    for (const [key, candidates] of groups) {
      const winner =
        candidates.length > 1 ? [...candidates].sort((a, b) => pickRank(a) - pickRank(b))[0]! : candidates[0]!;
      winnerByKey.set(key, winner);
    }
    const emitted = new Set<string>();
    const result: string[] = [];
    for (const src of variantFiltered) {
      const filename = src.split("/").pop() || src;
      const parsed = parseEpisodePath(filename);
      if (!parsed) {
        result.push(src);
        continue;
      }
      const key = `s${parsed.season}e${parsed.episode}`;
      if (emitted.has(key)) continue;
      emitted.add(key);
      result.push(winnerByKey.get(key) ?? src);
    }
    return result;
  }, [details?.videos, hasBothVariants, selectedVariant, variantMap]);

  const grouped = useMemo(() => {
    if (!details)
      return {
        bySeason: new Map<number, EpisodeEntry[]>(),
        other: [] as EpisodeEntry[],
      };
    const bySeason = new Map<number, EpisodeEntry[]>();
    const other: EpisodeEntry[] = [];
    const sorted = [...filteredVideos].sort(compareVideoSrc);
    for (const video of sorted) {
      const entry = buildEntry(video, details.dirPath);
      if (entry.parsed) {
        const list = bySeason.get(entry.parsed.season) ?? [];
        list.push(entry);
        bySeason.set(entry.parsed.season, list);
      } else {
        other.push(entry);
      }
    }
    return { bySeason, other };
  }, [details, filteredVideos]);

  const seasonKeys = useMemo(() => [...grouped.bySeason.keys()].sort((a, b) => a - b), [grouped.bySeason]);

  const progressByVideo = useMemo(() => {
    const map = new Map<string, { current_time: number; duration: number }>();
    for (const entry of progressQuery.data || []) {
      map.set(entry.video_src, {
        current_time: entry.current_time,
        duration: entry.duration,
      });
    }
    return map;
  }, [progressQuery.data]);

  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [seasonMenuOpen, setSeasonMenuOpen] = useState(false);
  const [episodeViewportHeight, setEpisodeViewportHeight] = useState(0);
  const episodeScrollRef = useRef<ScrollView>(null);

  const effectiveSeason = selectedSeason ?? seasonKeys[0] ?? null;
  const seasonMeta = useMemo(
    () => details?.seasonsMeta?.find((m) => m.season === effectiveSeason) ?? null,
    [details?.seasonsMeta, effectiveSeason],
  );

  const playTarget = useMemo(() => {
    if (!filteredVideos.length) return null;
    // Most recently watched first (sort is stable, so entries without a timestamp keep server order).
    const entries = (progressQuery.data || [])
      .filter((entry) => filteredVideos.includes(entry.video_src))
      .sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? ""));
    const latest = entries[0];
    if (latest && isProgressWatched(latest)) {
      // Finished the last thing watched: move on to the episode after it.
      const nextIndex = filteredVideos.indexOf(latest.video_src) + 1;
      if (nextIndex < filteredVideos.length) {
        const next = progressByVideo.get(filteredVideos[nextIndex]);
        return { startIndex: nextIndex, initialTime: isProgressInProgress(next) ? (next?.current_time ?? 0) : 0 };
      }
    }
    const resumeEntry = entries.find((entry) => isProgressInProgress(entry));
    if (resumeEntry) {
      return { startIndex: filteredVideos.indexOf(resumeEntry.video_src), initialTime: resumeEntry.current_time };
    }
    return { startIndex: 0, initialTime: 0 };
  }, [filteredVideos, progressByVideo, progressQuery.data]);

  // Hero "Play" lands here with autoplay; start playback once the resume point is known.
  const autoplayedRef = useRef(false);
  useEffect(() => {
    const data = detailsQuery.data;
    if (!autoplay || autoplayedRef.current || !data || !playTarget || progressQuery.isLoading) return;
    autoplayedRef.current = true;
    navigation.setParams({ autoplay: false });
    navigation.navigate("Player", {
      dirPath: data.dirPath,
      title: data.name,
      videos: filteredVideos,
      startIndex: playTarget.startIndex,
      initialTime: playTarget.initialTime,
      subtitles: data.subtitles,
    });
  }, [autoplay, detailsQuery.data, playTarget, progressQuery.isLoading, filteredVideos, navigation]);

  if (detailsQuery.isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!details) {
    return null;
  }

  const bannerSrc = seasonMeta?.logo ?? details.bannerImage;
  const description = seasonMeta?.description ?? details.description;
  const imageUrl = resolveAssetUrl(bannerSrc);

  const startEpisodeDownload = (entry: EpisodeEntry) => {
    void startDownload({
      src: entry.video,
      dirPath: details.dirPath,
      title: details.name,
      episodeLabel: entry.parsed ? entry.label : undefined,
      poster: details.bannerImage,
      subtitles: details.subtitles,
      profileId,
    });
  };

  const deleteEpisodeDownload = (entry: EpisodeEntry) => {
    const id = makeDownloadId(entry.video, 0);
    Alert.alert("Remove download", `Delete "${entry.label}" from this device?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => void deleteDownload(id),
      },
    ]);
  };

  const downloadAll = () => {
    for (const video of filteredVideos) {
      startEpisodeDownload(buildEntry(video, details.dirPath));
    }
  };

  const visibleEntries = effectiveSeason != null ? (grouped.bySeason.get(effectiveSeason) ?? []) : grouped.other;

  const showDropdown = seasonKeys.length >= 2;

  const inList = !!watchlistQuery.data?.inList;
  const playFromTarget = () =>
    playTarget &&
    navigation.navigate("Player", {
      dirPath: details.dirPath,
      title: details.name,
      videos: filteredVideos,
      startIndex: playTarget.startIndex,
      initialTime: playTarget.initialTime,
      subtitles: details.subtitles,
    });
  const playLabel = playTarget?.initialTime ? "Resume" : "Play";
  const downloadLabel = filteredVideos.length > 1 ? `Download all (${filteredVideos.length})` : "Download";

  const listPill = (
    <Pressable
      onPress={() => toggleWatchlist.mutate()}
      accessibilityRole="button"
      style={({ pressed }) => [styles.listPill, inList && styles.listPillActive, pressed && styles.listPillPressed]}
      focusStyle={isLandscape ? focusGlow : undefined}
    >
      <Feather name={inList ? "check" : "plus"} size={14} color={inList ? colors.accentSoft : colors.text} />
      <Text style={[styles.listPillLabel, inList && styles.listPillLabelActive]}>
        {inList ? "In My List" : "My List"}
      </Text>
    </Pressable>
  );

  // Our own back button (the native header's can't be styled or given the focus glow).
  const backButton = (
    <Pressable
      onPress={() => navigation.goBack()}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={[styles.backButton, { top: insets.top + 16, left: insets.left + 16 }]}
      focusStyle={focusGlow}
    >
      <Feather name="arrow-left" size={22} color={colors.text} />
    </Pressable>
  );

  const detailsPanel = (
    <>
      <View style={[styles.banner, { minHeight: 260 + insets.top }]}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.bannerImage} resizeMode="cover" />
        ) : (
          <View style={[styles.bannerImage, styles.bannerFallback]} />
        )}
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(7,7,10,0.7)", "rgba(7,7,10,0)"]}
          style={styles.bannerTopFade}
        />
        <LinearGradient
          pointerEvents="none"
          colors={["rgba(7,7,10,0)", "rgba(7,7,10,0.55)", colors.background]}
          locations={[0, 0.5, 1]}
          style={styles.bannerScrim}
        />
        <View style={styles.bannerCopy}>
          <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
            {details.name}
          </Text>
          {listPill}
        </View>
      </View>
      <Text style={styles.meta}>{formatTitleType(details.type)}</Text>
      <Text style={styles.description}>{description}</Text>
      {details.genre?.length ? (
        <View style={styles.chipRow}>
          {details.genre.map((genre) => (
            <Pressable
              key={genre}
              onPress={() => navigation.navigate("Genre", { genre })}
              style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            >
              <Text style={styles.chipLabel}>{genre}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {details.cast?.length ? <Text style={styles.cast}>Cast: {details.cast.join(", ")}</Text> : null}
      <View style={styles.actionRow}>
        <PlayButton large preferredFocus label={playLabel} disabled={!playTarget} onPress={playFromTarget} />
        {filteredVideos.length ? (
          <GlassButton large icon="download" label={downloadLabel} onPress={downloadAll} />
        ) : null}
      </View>
    </>
  );

  // TV downloads the season on screen (the same as everything for a one-season show).
  const tvDownload =
    effectiveSeason != null && visibleEntries.length
      ? {
          label: `Download Season ${effectiveSeason} (${visibleEntries.length})`,
          onPress: () => {
            for (const entry of visibleEntries) startEpisodeDownload(entry);
          },
        }
      : { label: downloadLabel, onPress: downloadAll };

  // TV: the title block sits over the bottom of the full-width banner (no cast/genre chips, to keep
  // the actions on screen).
  const tvInfoPanel = (
    <>
      <Text style={styles.tvTitle} numberOfLines={2} accessibilityRole="header">
        {details.name}
      </Text>
      <Text style={styles.tvMeta} numberOfLines={1}>
        {[formatTitleType(details.type), ...(details.genre ?? []).slice(0, 2)].join("  ·  ")}
      </Text>
      {description ? (
        <Text style={styles.tvDescription} numberOfLines={3}>
          {description}
        </Text>
      ) : null}
      <View style={styles.tvPillRow}>{listPill}</View>
      <View style={styles.tvActions}>
        <PlayButton
          large
          preferredFocus
          label={playLabel}
          disabled={!playTarget}
          onPress={playFromTarget}
          iconNode={<Ionicons name="play" size={24} color={colors.playText} />}
          style={styles.tvActionButton}
          labelStyle={styles.tvActionLabel}
          focusStyle={focusGlow}
        />
        {filteredVideos.length ? (
          <GlassButton
            large
            label={tvDownload.label}
            onPress={tvDownload.onPress}
            iconNode={<Feather name="download" size={22} color={colors.text} />}
            style={[styles.tvActionButton, styles.tvGlassButton]}
            labelStyle={styles.tvActionLabel}
            focusStyle={focusGlow}
          />
        ) : null}
      </View>
    </>
  );

  const episodeRowHeight =
    isLandscape && episodeViewportHeight > 0
      ? Math.max(
          MIN_EPISODE_ROW_HEIGHT,
          (episodeViewportHeight - 2 * EPISODE_LIST_INSET - (EPISODES_PER_VIEW - 1) * EPISODE_GAP) / EPISODES_PER_VIEW,
        )
      : undefined;

  // Like the home rows: keep the focused episode in the second slot, so the rows either side are
  // already on screen and Android never jumps the list; it glides here instead.
  const glideToEpisode = (index: number) => {
    if (!episodeRowHeight) return;
    const stride = episodeRowHeight + EPISODE_GAP;
    episodeScrollRef.current?.scrollTo({ y: Math.max(0, (index - EPISODE_FOCUS_SLOT) * stride), animated: true });
  };

  const seasonPicker = showDropdown ? (
    <View style={isLandscape ? styles.tvSeasonPicker : styles.seasonSection}>
      <Pressable
        onPress={() => setSeasonMenuOpen((open) => !open)}
        style={[styles.seasonTrigger, isLandscape && styles.tvSeasonTrigger]}
        focusStyle={isLandscape ? focusGlow : undefined}
      >
        <Text style={styles.seasonTriggerLabel}>Season {effectiveSeason}</Text>
        <Feather name={seasonMenuOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.text} />
      </Pressable>
      {seasonMenuOpen ? (
        <View style={[styles.menuSheet, isLandscape && styles.tvMenuSheet]}>
          {seasonKeys.map((season) => {
            const active = season === effectiveSeason;
            return (
              <Pressable
                key={season}
                onPress={() => {
                  setSelectedSeason(season);
                  setSeasonMenuOpen(false);
                }}
                style={[styles.menuItem, active && styles.menuItemActive]}
              >
                <Text style={styles.menuLabel}>Season {season}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  ) : null;

  const variantPicker = hasBothVariants ? (
    <View style={styles.variantRow}>
      {(["sub", "dub", "both"] as AudioSelection[]).map((option) => {
        const active = (selectedVariant ?? "sub") === option;
        const label = option === "both" ? "Sub + Dub" : option === "sub" ? "Sub" : "Dub";
        return (
          <Pressable
            key={option}
            onPress={() => setSelectedVariant(option)}
            style={[styles.variantOption, active && styles.variantOptionActive]}
          >
            <Text style={[styles.variantLabel, active && styles.variantLabelActive]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  ) : null;

  const episodesHeading =
    seasonKeys.length > 0 ? (
      <Text style={[styles.sectionTitle, isLandscape && styles.tvSectionTitle]}>Episodes</Text>
    ) : null;

  const episodesHeader = (
    <>
      {seasonPicker}
      {variantPicker}
      {episodesHeading}
    </>
  );

  const episodeRows = (
    <>
      {visibleEntries.length ? (
        visibleEntries.map((entry, index) => {
          const startIndex = filteredVideos.indexOf(entry.video);
          const progress = progressByVideo.get(entry.video) ?? null;
          const download = downloadItems[makeDownloadId(entry.video, 0)];
          return (
            <EpisodeRow
              key={entry.video}
              style={episodeRowHeight ? { height: episodeRowHeight } : undefined}
              onFocus={episodeRowHeight ? () => glideToEpisode(index) : undefined}
              parsed={entry.parsed}
              fallbackLabel={entry.label}
              progress={progress}
              downloadStatus={download?.status}
              downloadProgress={download?.progress}
              onDownload={() => startEpisodeDownload(entry)}
              onDeleteDownload={() => deleteEpisodeDownload(entry)}
              onPlay={() =>
                navigation.navigate("Player", {
                  dirPath: details.dirPath,
                  title: details.name,
                  videos: filteredVideos,
                  startIndex: startIndex >= 0 ? startIndex : 0,
                  initialTime: progress?.current_time ?? 0,
                  subtitles: details.subtitles,
                })
              }
              onRestart={() =>
                navigation.navigate("Player", {
                  dirPath: details.dirPath,
                  title: details.name,
                  videos: filteredVideos,
                  startIndex: startIndex >= 0 ? startIndex : 0,
                  initialTime: 0,
                  subtitles: details.subtitles,
                })
              }
            />
          );
        })
      ) : (
        <EmptyState
          title="No playable files found"
          subtitle="This title does not currently expose any videos from the server."
        />
      )}
    </>
  );

  if (isLandscape) {
    return (
      <View style={styles.tvRoot}>
        <LinearGradient
          pointerEvents="none"
          colors={TV_PAGE_GRADIENT}
          locations={TV_PAGE_GRADIENT_STOPS}
          style={StyleSheet.absoluteFill}
        />
        <TvBanner uri={imageUrl} height={height * TV_BANNER_FRACTION} fadeTo={TV_PAGE_GRADIENT[1]} />
        {/* Black-to-navy wash; overlaps only the banner's faded bottom, hiding its edge. */}
        <LinearGradient
          pointerEvents="none"
          colors={TV_BLUE_WASH}
          locations={[0, 0.4, 1]}
          start={{ x: 0.2, y: 1 }}
          end={{ x: 0.3, y: 0.55 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.tvColumns, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <ScrollView
            style={styles.tvInfoColumn}
            contentContainerStyle={styles.tvInfoContent}
            showsVerticalScrollIndicator={false}
          >
            {tvInfoPanel}
          </ScrollView>
          <View style={[styles.tvEpisodesColumn, { paddingTop: height * TV_EPISODES_TOP_FRACTION }]}>
            <View style={styles.episodesHeader}>{episodesHeader}</View>
            <ScrollView
              testID="episode-scroller"
              ref={episodeScrollRef}
              style={styles.episodeScroller}
              contentContainerStyle={styles.episodeListContent}
              showsVerticalScrollIndicator={false}
              onLayout={(event) => setEpisodeViewportHeight(event.nativeEvent.layout.height)}
            >
              {episodeRows}
            </ScrollView>
          </View>
        </View>
        {backButton}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {detailsPanel}
        {episodesHeader}
        <View style={styles.episodeList}>{episodeRows}</View>
      </ScrollView>
      {backButton}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 36,
  },
  backButton: {
    position: "absolute",
    zIndex: 10,
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(5,9,22,0.55)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  tvRoot: {
    flex: 1,
    backgroundColor: TV_PAGE_GRADIENT[2],
  },
  tvColumns: {
    flex: 1,
    flexDirection: "row",
  },
  tvInfoColumn: {
    flex: 1.1,
  },
  tvInfoContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingTop: 88,
    paddingLeft: 48,
    paddingRight: 28,
    paddingBottom: 32,
  },
  tvTitle: {
    color: "#ffffff",
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -1.2,
    textShadowColor: "rgba(0,0,0,0.55)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 12,
  },
  tvMeta: {
    marginTop: 8,
    color: colors.accentText,
    fontFamily: fonts.bodyBold,
    fontSize: 13,
    letterSpacing: 4,
    textTransform: "uppercase",
  },
  tvDescription: {
    marginTop: 12,
    color: colors.textSoft,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  tvPillRow: {
    marginTop: 18,
  },
  tvActions: {
    marginTop: 22,
    gap: 12,
  },
  // Icon and label on the left, like the mockup.
  tvActionButton: {
    justifyContent: "flex-start",
    gap: 18,
    paddingHorizontal: 28,
    paddingVertical: 15,
    borderRadius: 12,
  },
  tvActionLabel: {
    fontFamily: fonts.bodyBold,
    fontSize: 19,
  },
  tvGlassButton: {
    backgroundColor: "rgba(14,30,72,0.75)",
    borderWidth: 1,
    borderColor: "rgba(96,165,250,0.3)",
  },
  tvEpisodesColumn: {
    flex: 1,
    paddingRight: 16,
  },
  tvSectionTitle: {
    marginTop: 12,
    marginBottom: 0,
    fontSize: 24,
  },
  tvSeasonPicker: {
    zIndex: 10,
  },
  tvSeasonTrigger: {
    paddingVertical: 11,
    backgroundColor: "rgba(14,30,72,0.75)",
    borderColor: "rgba(96,165,250,0.3)",
  },
  // Overlays the list instead of pushing it down.
  tvMenuSheet: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
    backgroundColor: "rgba(8,15,38,0.97)",
  },
  episodesHeader: {
    paddingHorizontal: 20,
    zIndex: 2,
  },
  episodeScroller: {
    flex: 1,
  },
  episodeListContent: {
    paddingHorizontal: 20,
    paddingVertical: EPISODE_LIST_INSET,
    gap: EPISODE_GAP,
  },
  episodeList: {
    gap: EPISODE_GAP,
  },
  banner: {
    marginHorizontal: -20,
    marginTop: -20,
    justifyContent: "flex-end",
    overflow: "hidden",
    backgroundColor: colors.surface,
  },
  bannerImage: {
    ...StyleSheet.absoluteFill,
    width: "100%",
    height: "100%",
  },
  bannerFallback: {
    backgroundColor: colors.surfaceElevated,
  },
  bannerTopFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 110,
  },
  bannerScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "75%",
  },
  bannerCopy: {
    paddingHorizontal: 22,
    paddingBottom: 14,
    gap: 12,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  title: {
    color: "#ffffff",
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: -1,
  },
  listPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  listPillActive: {
    backgroundColor: colors.primaryTint,
    borderColor: "rgba(59,130,246,0.4)",
  },
  listPillPressed: {
    opacity: 0.8,
  },
  listPillLabel: {
    color: colors.text,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  listPillLabelActive: {
    color: colors.accentSoft,
  },
  meta: {
    color: colors.accentText,
    fontFamily: fonts.bodySemiBold,
    marginTop: 14,
  },
  description: {
    color: colors.textSoft,
    fontFamily: fonts.body,
    marginTop: 12,
    lineHeight: 22,
    fontSize: 15,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 16,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceAccent,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipPressed: {
    backgroundColor: colors.border,
  },
  chipLabel: {
    color: colors.textSoft,
    fontFamily: fonts.bodySemiBold,
    fontSize: 12,
  },
  cast: {
    color: colors.textMuted,
    fontFamily: fonts.body,
    marginTop: 16,
    fontSize: 14,
    lineHeight: 21,
  },
  actionRow: {
    marginTop: 18,
    gap: 10,
  },
  seasonSection: {
    marginTop: 24,
  },
  seasonTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceAccent,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seasonTriggerLabel: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 16,
  },
  menuSheet: {
    marginTop: 8,
    backgroundColor: colors.glassStrong,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 8,
    gap: 4,
  },
  menuItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "transparent",
  },
  menuItemActive: {
    backgroundColor: colors.surfaceAccent,
  },
  menuLabel: {
    color: colors.text,
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 22,
    letterSpacing: -0.4,
    marginTop: 24,
    marginBottom: 14,
  },
  variantRow: {
    flexDirection: "row",
    marginTop: 18,
    backgroundColor: colors.surfaceAccent,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  variantOption: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  variantOptionActive: {
    backgroundColor: colors.primary,
  },
  variantLabel: {
    color: colors.textSoft,
    fontWeight: "700",
    fontSize: 13,
  },
  variantLabelActive: {
    color: colors.primaryText,
  },
});
