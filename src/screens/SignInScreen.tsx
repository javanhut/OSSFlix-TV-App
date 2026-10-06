import { useMemo, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { Pressable } from "../components/FocusPressable";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";

import { api } from "../api/client";
import { AuthStage, authStyles } from "../components/AuthStage";
import { PrimaryButton } from "../components/Buttons";
import { ProfileAvatar } from "../components/ProfileAvatar";
import { PasswordField } from "../components/PasswordField";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { useSessionStore } from "../state/session";
import { colors } from "../theme/colors";
import { fonts } from "../theme/typography";
import { useAllowRotation } from "../hooks/useAllowRotation";

type Props = NativeStackScreenProps<RootStackParamList, "SignIn">;

export function SignInScreen({ navigation }: Props) {
  useAllowRotation();

  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const selectedProfile = useSessionStore((state) => state.selectedProfile);
  const setAuthenticatedSession = useSessionStore((state) => state.setAuthenticatedSession);

  const needsSetPassword = useMemo(() => selectedProfile && !selectedProfile.has_password, [selectedProfile]);

  const submit = async () => {
    if (!selectedProfile) {
      navigation.goBack();
      return;
    }
    try {
      setSubmitting(true);
      const response = needsSetPassword
        ? await api.mobileSetPassword(selectedProfile.id, password)
        : await api.mobileLogin(selectedProfile.id, password);
      if (!response?.token || !response?.profile) {
        throw new Error("Server did not return a valid session. Please try again.");
      }
      setAuthenticatedSession(response.token, response.profile);
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unable to sign in.";
      const message =
        raw === "password_not_set" ? "This profile has no password yet. Go back and select it again to set one." : raw;
      Alert.alert("Authentication failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthStage topPadding={72}>
      <View style={styles.identity}>
        {selectedProfile ? <ProfileAvatar profile={selectedProfile} size={96} /> : null}
        <Text style={[authStyles.heading, styles.center]} accessibilityRole="header">
          {selectedProfile?.name || "Profile"}
        </Text>
        <Text style={[authStyles.subheading, styles.center]}>
          {needsSetPassword ? "Set a password for this profile." : "Enter the profile password to continue."}
        </Text>
      </View>
      <View style={[authStyles.card, styles.card]}>
        <PasswordField value={password} onChangeText={setPassword} placeholder="Password" />
        <PrimaryButton
          large
          icon={needsSetPassword ? "lock" : "log-in"}
          label={submitting ? "Working..." : needsSetPassword ? "Set Password" : "Sign In"}
          onPress={submit}
          disabled={submitting}
        />
      </View>
      <Pressable onPress={() => navigation.goBack()} style={styles.back} accessibilityRole="button">
        <Feather name="chevron-left" size={16} color={colors.textMuted} />
        <Text style={styles.backLabel}>Back</Text>
      </Pressable>
    </AuthStage>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: "center",
    gap: 10,
  },
  center: {
    textAlign: "center",
  },
  card: {
    marginTop: 28,
    gap: 14,
  },
  back: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 4,
    marginTop: 24,
    padding: 8,
  },
  backLabel: {
    color: colors.textMuted,
    fontFamily: fonts.bodySemiBold,
    fontSize: 14,
  },
});
