import { Image, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

/**
 * Full-width artwork behind the top of the TV details page. Darkened on the left for the title and
 * faded at the bottom into `fadeTo`, the page color where the banner ends.
 */
export function TvBanner({ uri, height, fadeTo }: { uri: string | null; height: number; fadeTo: string }) {
  return (
    <View pointerEvents="none" style={[styles.banner, { height }]} testID="tv-banner">
      {uri ? (
        <Image testID="tv-banner-image" source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
      ) : null}
      <LinearGradient
        colors={["rgba(4,8,20,0.9)", "rgba(4,8,20,0.45)", "rgba(4,8,20,0)"]}
        locations={[0, 0.45, 0.8]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["rgba(5,10,27,0)", "rgba(5,10,27,0.75)", fadeTo]}
        locations={[0.25, 0.65, 1]}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    overflow: "hidden",
  },
});
