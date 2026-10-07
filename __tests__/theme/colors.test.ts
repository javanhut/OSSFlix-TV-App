import { colors } from "../../src/theme/colors";

// Solid hex, or rgba() for the translucent glass/border tokens.
const COLOR = /^(#[0-9a-fA-F]{6}|rgba\(\d{1,3},\d{1,3},\d{1,3},(0|1|0?\.\d+)\))$/;

describe("theme/colors", () => {
  const requiredKeys: (keyof typeof colors)[] = [
    "background",
    "surface",
    "surfaceElevated",
    "surfaceHover",
    "surfaceAccent",
    "glass",
    "glassStrong",
    "border",
    "borderBright",
    "borderStrong",
    "primary",
    "primaryPressed",
    "primaryText",
    "primaryTint",
    "accentText",
    "accentSoft",
    "text",
    "textMuted",
    "textSoft",
    "textDim",
    "play",
    "playPressed",
    "playFocused",
    "playText",
    "green",
  ];

  it.each(requiredKeys)("exposes %s as a hex or rgba color", (key) => {
    expect(colors[key]).toMatch(COLOR);
  });

  it("has no extra keys (catches accidental drift)", () => {
    expect(Object.keys(colors).sort()).toEqual([...requiredKeys].sort());
  });
});
