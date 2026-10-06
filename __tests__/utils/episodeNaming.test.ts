import {
  canonicalFilename,
  compareVideoSrc,
  detectVariant,
  formatEpisodeLabel,
  inferEpisodeVariants,
  parseEpisodePath,
  titleFromStem,
} from "../../src/utils/episodeNaming";

describe("titleFromStem", () => {
  it("returns empty string for empty input", () => {
    expect(titleFromStem("")).toBe("");
    expect(titleFromStem("   ")).toBe("");
  });

  it("replaces underscores with spaces and Title Cases", () => {
    expect(titleFromStem("the_pilot_episode")).toBe("The Pilot Episode");
  });

  it("collapses repeated whitespace", () => {
    expect(titleFromStem("a   long    title")).toBe("A Long Title");
  });
});

describe("formatEpisodeLabel", () => {
  it("includes the title when present", () => {
    expect(formatEpisodeLabel({ season: 1, episode: 2, title: "Pilot", ext: "mkv" })).toBe("S1 E2 - Pilot");
  });

  it("omits the dash when title is empty", () => {
    expect(formatEpisodeLabel({ season: 3, episode: 4, title: "", ext: "mkv" })).toBe("S3 E4");
  });
});

describe("canonicalFilename", () => {
  it("pads season and episode to two digits", () => {
    expect(canonicalFilename({ season: 1, episode: 2, title: "Pilot", ext: "mkv" })).toBe("pilot_s01_ep02.mkv");
  });

  it("falls back to 'episode' when the title slugs to empty", () => {
    expect(canonicalFilename({ season: 1, episode: 2, title: "///", ext: "mkv" })).toBe("episode_s01_ep02.mkv");
  });

  it("uses the raw number when ≥10", () => {
    expect(canonicalFilename({ season: 12, episode: 23, title: "Big", ext: "mkv" })).toBe("big_s12_ep23.mkv");
  });
});

describe("parseEpisodePath", () => {
  it("returns null for an empty path", () => {
    expect(parseEpisodePath("")).toBeNull();
  });

  it("returns null when no season or episode info is present", () => {
    expect(parseEpisodePath("just_a_movie.mkv")).toBeNull();
  });

  it("parses season/episode from path segments", () => {
    const parsed = parseEpisodePath("s1/ep2/The Bank Job.mkv");
    expect(parsed?.season).toBe(1);
    expect(parsed?.episode).toBe(2);
    expect(parsed?.title).toBe("The Bank Job");
    expect(parsed?.ext).toBe("mkv");
  });

  it("parses canonical s##_ep## suffix in filename", () => {
    const parsed = parseEpisodePath("MyShow_s02_ep03.mkv");
    expect(parsed?.season).toBe(2);
    expect(parsed?.episode).toBe(3);
    expect(parsed?.title).toBe("MyShow");
  });

  it("strips duplicate s##_ep## tokens in the title remnant", () => {
    const parsed = parseEpisodePath("something_s02_ep11_summer_of_growth_s02_ep11.mkv");
    expect(parsed?.season).toBe(2);
    expect(parsed?.episode).toBe(11);
    expect(parsed?.title).toBe("Something Summer Of Growth");
  });

  it("strips _sub/_dub from the title remnant", () => {
    const parsed = parseEpisodePath("clip_s01_ep01_sub.mkv");
    expect(parsed?.title).toBe("Clip");
  });

  it("handles files with no extension", () => {
    const parsed = parseEpisodePath("s1/ep4/Untitled");
    expect(parsed?.ext).toBe("");
    expect(parsed?.episode).toBe(4);
  });
});

describe("detectVariant", () => {
  it("detects sub", () => {
    expect(detectVariant("episode_s01_ep01_sub.mkv")).toBe("sub");
  });

  it("detects dub", () => {
    expect(detectVariant("episode_s01_ep01_DUB.mp4")).toBe("dub");
  });

  it("returns null when no variant suffix is present", () => {
    expect(detectVariant("episode_s01_ep01.mkv")).toBeNull();
  });
});

describe("inferEpisodeVariants", () => {
  it("returns explicit variants and infers the missing partner", () => {
    const map = inferEpisodeVariants(["show/s01/ep01/foo_s01_ep01_sub.mkv", "show/s01/ep01/foo_s01_ep01.mkv"]);
    expect(map.get("show/s01/ep01/foo_s01_ep01_sub.mkv")).toBe("sub");
    // Untagged sibling should be inferred as dub.
    expect(map.get("show/s01/ep01/foo_s01_ep01.mkv")).toBe("dub");
  });

  it("leaves variant null when there's only one file per episode", () => {
    const map = inferEpisodeVariants(["show/s01/ep01/foo_s01_ep01.mkv"]);
    expect(map.get("show/s01/ep01/foo_s01_ep01.mkv")).toBeNull();
  });

  it("does not infer when both variants are explicitly present", () => {
    const map = inferEpisodeVariants(["show/s01/ep01/foo_s01_ep01_sub.mkv", "show/s01/ep01/foo_s01_ep01_dub.mkv"]);
    expect(map.get("show/s01/ep01/foo_s01_ep01_sub.mkv")).toBe("sub");
    expect(map.get("show/s01/ep01/foo_s01_ep01_dub.mkv")).toBe("dub");
  });
});

describe("compareVideoSrc", () => {
  it("sorts by season then episode when both paths are parseable", () => {
    const inputs = ["show/s01/ep03/c.mkv", "show/s02/ep01/d.mkv", "show/s01/ep01/a.mkv", "show/s01/ep02/b.mkv"];
    const sorted = [...inputs].sort(compareVideoSrc);
    expect(sorted).toEqual([
      "show/s01/ep01/a.mkv",
      "show/s01/ep02/b.mkv",
      "show/s01/ep03/c.mkv",
      "show/s02/ep01/d.mkv",
    ]);
  });

  it("places parseable entries before unparseable ones", () => {
    const sorted = ["plain.mkv", "show/s01/ep01/a.mkv"].sort(compareVideoSrc);
    expect(sorted[0]).toBe("show/s01/ep01/a.mkv");
  });

  it("falls back to numeric localeCompare when neither side parses", () => {
    const sorted = ["track 2.mkv", "track 10.mkv", "track 1.mkv"].sort(compareVideoSrc);
    expect(sorted).toEqual(["track 1.mkv", "track 2.mkv", "track 10.mkv"]);
  });
});
