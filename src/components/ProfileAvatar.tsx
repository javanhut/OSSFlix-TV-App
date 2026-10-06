import { Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { resolveAssetUrl } from "../api/client";
import { fonts } from "../theme/typography";

/** Profile picture, or a gradient tile with the profile's initial (web ProfileSelect). */
export function ProfileAvatar({
  profile,
  size,
}: {
  profile: { id: number; name: string; image_path: string | null };
  size: number;
}) {
  const uri = resolveAssetUrl(profile.image_path);
  const radius = Math.round(size * 0.18);
  if (uri) {
    return <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: radius }]} />;
  }
  const hue = (profile.id * 67) % 360;
  return (
    <LinearGradient
      colors={[`hsl(${hue}, 70%, 55%)`, `hsl(${(hue + 40) % 360}, 65%, 32%)`]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.fallback, { width: size, height: size, borderRadius: radius }]}
    >
      <Text style={[styles.initial, { fontSize: size * 0.42 }]}>{profile.name.trim().charAt(0).toUpperCase()}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: "#18181f",
  },
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initial: {
    color: "#ffffff",
    fontFamily: fonts.display,
  },
});
