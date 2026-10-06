import { formatTitleType } from "../../src/utils/titleType";

describe("formatTitleType", () => {
  it("returns empty for nullish input", () => {
    expect(formatTitleType(null)).toBe("");
    expect(formatTitleType(undefined)).toBe("");
    expect(formatTitleType("")).toBe("");
  });

  it("maps tv show aliases to 'TV Show'", () => {
    expect(formatTitleType("tv show")).toBe("TV Show");
    expect(formatTitleType(" Tv-Show ")).toBe("TV Show");
    expect(formatTitleType("TVSHOW")).toBe("TV Show");
  });

  it("maps movie to 'Movie'", () => {
    expect(formatTitleType("movie")).toBe("Movie");
    expect(formatTitleType("MOVIE")).toBe("Movie");
  });

  it("title-cases an unknown type", () => {
    expect(formatTitleType("documentary")).toBe("Documentary");
    expect(formatTitleType("limited series")).toBe("Limited Series");
  });
});
