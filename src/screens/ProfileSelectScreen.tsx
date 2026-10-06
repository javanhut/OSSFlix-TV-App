import { StyleSheet, Text, View } from "react-native";
import { Pressable } from "../components/FocusPressable";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { AuthStage, authStyles } from "../components/AuthStage";
import { EmptyState } from "../components/EmptyState";
import { ProfileAvatar } from "../components/ProfileAvatar";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useSessionStore } from "../state/session";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import type { PublicProfile } from "../types/api";

type Props = NativeStackScreenProps<RootStackParamList, "ProfileSelect">;

export function ProfileSelectScreen({ navigation, route }: Props) {
  const { profiles, source } = route.params;
  const setSelectedProfile = useSessionStore((state) => state.setSelectedProfile);

  const handleSelect = (profile: PublicProfile) => {
    setSelectedProfile(profile);
    navigation.navigate("SignIn");
  };

  return (
    <AuthStage topPadding={72}>
      <Text style={styles.heading} accessibilityRole="header">
        Who's watching?
      </Text>
      <Text style={[authStyles.subheading, styles.subheading]}>
        {source === "unclaimed" ? "Unclaimed profiles" : "Your profiles"}
      </Text>
      {profiles.length ? (
        <View style={styles.grid}>
          {profiles.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => handleSelect(item)}
              style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
              accessibilityRole="button"
              accessibilityLabel={`Choose ${item.name}`}
            >
              <View>
                <ProfileAvatar profile={item} size={104} />
                <View style={styles.lockBadge}>
                  <Feather name={item.has_password ? "lock" : "unlock"} size={11} color={colors.text} />
                </View>
              </View>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {item.has_password ? "Password protected" : "Needs password"}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <EmptyState title="No profiles" subtitle="Go back and try a different email or use an unclaimed profile." />
        </View>
      )}
      <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button">
        <Feather name="chevron-left" size={16} color={colors.textMuted} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
    </AuthStage>
  );
}

const styles = StyleSheet.create({
  heading: {
    color: colors.text,
    fontFamily: fonts.displayBold,
    fontSize: 34,
    letterSpacing: -1,
    textAlign: "center",
  },
  subheading: {
    textAlign: "center",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 24,
    marginTop: 32,
  },
  tile: {
    width: 132,
    alignItems: "center",
    padding: 6,
    borderRadius: 24,
  },
  tilePressed: {
    transform: [{ scale: 1.04 }],
  },
  lockBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.glassStrong,
    borderWidth: 1,
    borderColor: colors.borderBright,
  },
  name: {
    color: "rgba(255,255,255,0.85)",
    fontFamily: fonts.bodySemiBold,
    fontSize: 15,
    marginTop: 12,
  },
  meta: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 12,
    marginTop: 2,
  },
  empty: {
    marginTop: 28,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 4,
    marginTop: 36,
    padding: 8,
  },
  backLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
});
