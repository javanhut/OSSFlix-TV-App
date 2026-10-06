import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Pressable } from "../components/FocusPressable";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { api } from "../api/client";
import { AuthStage, BrandWordmark, authStyles } from "../components/AuthStage";
import { GlassButton, PrimaryButton } from "../components/Buttons";
import { useSessionStore } from "../state/session";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { useAllowRotation } from "../hooks/useAllowRotation";

type Props = NativeStackScreenProps<RootStackParamList, "ProfileLookup">;

export function ProfileLookupScreen({ navigation }: Props) {
  useAllowRotation();
  const { width, height } = useWindowDimensions();
  // TVs and landscape tablets: showcase beside the form, like the web login.
  const wide = width >= 900 && width > height;

  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const setSelectedProfile = useSessionStore((state) => state.setSelectedProfile);
  const setServerUrl = useSessionStore((state) => state.setServerUrl);
  const currentServerUrl = useSessionStore((state) => state.serverUrl);

  const handleLookup = async () => {
    try {
      setSubmitting(true);
      const data = await api.lookupProfiles(email.trim());
      if (!data.profiles.length) {
        Alert.alert("No profiles", "No profiles were found for that email address.");
        return;
      }
      navigation.navigate("ProfileSelect", {
        profiles: data.profiles,
        source: "email",
      });
    } catch (error) {
      Alert.alert("Lookup failed", error instanceof Error ? error.message : "Unable to load profiles.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnclaimed = async () => {
    try {
      setSubmitting(true);
      const data = await api.lookupUnclaimed();
      if (!data.profiles.length) {
        Alert.alert("No profiles", "This server has no unclaimed profiles.");
        return;
      }
      navigation.navigate("ProfileSelect", {
        profiles: data.profiles,
        source: "unclaimed",
      });
    } catch (error) {
      Alert.alert("Lookup failed", error instanceof Error ? error.message : "Unable to load profiles.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuest = async () => {
    try {
      setSubmitting(true);
      const data = await api.getGuestProfile();
      setSelectedProfile(data.profile);
      navigation.navigate("SignIn");
    } catch (error) {
      Alert.alert("Guest unavailable", error instanceof Error ? error.message : "Unable to load guest profile.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthStage topPadding={28}>
      <View style={wide && styles.wideRow}>
        <View style={wide && styles.wideShowcase}>
          <BrandWordmark />
          <Text style={[styles.tagline, wide && styles.taglineWide]}>{"Your library.\nYour screen."}</Text>
        </View>
        <View style={[styles.panel, wide && styles.panelWide]}>
          <Text style={authStyles.heading} accessibilityRole="header">
            Welcome back
          </Text>
          <Text style={authStyles.subheading}>Find your profile to start watching.</Text>
          <View style={[authStyles.card, styles.card]}>
            <View style={styles.serverRow}>
              <Feather name="server" size={14} color={colors.textMuted} />
              <Text style={styles.serverLabel} numberOfLines={1}>
                {currentServerUrl ? currentServerUrl : "No server configured"}
              </Text>
              <Pressable onPress={() => setServerUrl("")} hitSlop={8} accessibilityRole="button">
                <Text style={styles.changeLabel}>Change</Text>
              </Pressable>
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="Email"
              placeholderTextColor={colors.textDim}
              style={authStyles.input}
            />
            <PrimaryButton
              label={submitting ? "Loading..." : "Find Profiles"}
              onPress={handleLookup}
              disabled={submitting}
              large
              preferredFocus
            />
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerLabel}>or</Text>
              <View style={styles.dividerLine} />
            </View>
            <GlassButton label="Use Unclaimed Profile" icon="users" onPress={handleUnclaimed} disabled={submitting} />
            <GlassButton label="Continue as Guest" icon="user" onPress={handleGuest} disabled={submitting} />
          </View>
          <Pressable onPress={() => navigation.navigate("Register")} style={styles.linkButton}>
            <Text style={styles.linkLabel}>Create a new profile</Text>
          </Pressable>
        </View>
      </View>
    </AuthStage>
  );
}

const styles = StyleSheet.create({
  tagline: {
    color: "#ffffff",
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.6,
    marginTop: 64,
  },
  taglineWide: {
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -2.2,
    marginTop: 28,
  },
  panel: {
    marginTop: 36,
  },
  wideRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 56,
    flexGrow: 1,
  },
  wideShowcase: {
    flex: 1,
  },
  panelWide: {
    width: 460,
    marginTop: 0,
  },
  card: {
    marginTop: 18,
    gap: 12,
  },
  serverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 4,
  },
  serverLabel: {
    flex: 1,
    color: colors.textMuted,
    fontFamily: fonts.body,
    fontSize: 13,
  },
  changeLabel: {
    color: colors.accentText,
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  dividerLabel: {
    color: colors.textDim,
    fontFamily: fonts.body,
    fontSize: 12,
  },
  linkButton: {
    marginTop: 18,
    alignSelf: "center",
  },
  linkLabel: {
    color: colors.accentText,
    fontFamily: fonts.bodySemiBold,
  },
});
