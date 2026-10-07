// Mirrors the Reelscape web redesign tokens (OSSFlix styles.css :root).
export const colors = {
  background: "#07070a",
  surface: "#111116",
  surfaceElevated: "#18181f",
  surfaceHover: "#22222b",
  surfaceAccent: "rgba(255,255,255,0.1)",
  glass: "rgba(20,20,26,0.72)",
  glassStrong: "rgba(14,14,18,0.88)",
  border: "rgba(255,255,255,0.08)",
  borderBright: "rgba(255,255,255,0.16)",
  borderStrong: "#3b82f6",
  primary: "#3b82f6",
  primaryPressed: "#2563eb",
  primaryText: "#ffffff",
  primaryTint: "rgba(59,130,246,0.22)",
  accentText: "#60a5fa",
  accentSoft: "#93c5fd",
  text: "#f4f4f6",
  textMuted: "#9a9aa8",
  textSoft: "#c8c8d2",
  textDim: "#6b6b78",
  // Play/Resume: Reelscape blue rather than the web's white, to sit with the navy TV look.
  play: "#2563eb",
  playPressed: "#1d4ed8",
  playFocused: "#3b82f6",
  playText: "#ffffff",
  green: "#22c55e",
};

export const brandGradient = ["#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"] as const;
