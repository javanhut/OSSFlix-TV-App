import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Pressable } from "../components/FocusPressable";
import { Feather } from "@expo/vector-icons";
import { useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { api, resolveAssetUrl } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { EmptyState } from "../components/EmptyState";
import { PasswordField } from "../components/PasswordField";
import { colors } from "../theme/colors";
import { useSessionStore } from "../state/session";
import type { PublicProfile } from "../types/api";
import type { RootStackParamList } from "../navigation/RootNavigator";

type Props = NativeStackScreenProps<RootStackParamList, "SwitchProfile">;

export function SwitchProfileScreen({ navigation }: Props) {
  const queryClient = useQueryClient();
  const currentProfile = useSessionStore((state) => state.profile);
  const setAuthenticatedSession = useSessionStore((state) => state.setAuthenticatedSession);

  const [profiles, setProfiles] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PublicProfile | null>(null);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const email = currentProfile?.email ?? "";

  useEffect(() => {
    let cancelled = false;
    if (!email) {
      setLoading(false);
      return;
    }
    setLoading(true);
    api
      .lookupProfiles(email)
      .then((data) => {
        if (cancelled) return;
        setProfiles(data.profiles || []);
      })
      .catch((err) => {
        if (cancelled) return;
        Alert.alert("Lookup failed", err instanceof Error ? err.message : "Unable to load profiles.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [email]);

  const handleSelect = (profile: PublicProfile) => {
    if (profile.id === currentProfile?.id) {
      navigation.goBack();
      return;
    }
    setSelected(profile);
    setPassword("");
  };

  const needsSetPassword = !!selected && !selected.has_password;

  const handleSubmit = async () => {
    if (!selected) return;
    if (!password) {
      Alert.alert(
        "Password required",
        needsSetPassword ? "Set a password for this profile." : "Enter the profile password.",
      );
      return;
    }
    try {
      setSubmitting(true);
      const response = needsSetPassword
        ? await api.mobileSetPassword(selected.id, password)
        : await api.mobileLogin(selected.id, password);
      if (!response?.token || !response?.profile) {
        throw new Error("Server did not return a valid session.");
      }
      queryClient.clear();
      setAuthenticatedSession(response.token, response.profile);
      navigation.goBack();
    } catch (error) {
      const raw = error instanceof Error ? error.message : "Unable to sign in.";
      const message =
        raw === "password_not_set"
          ? "This profile has no password yet. Set one below."
          : raw === "invalid_credentials"
            ? "Wrong password. Try again."
            : raw;
      Alert.alert("Switch failed", message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!email) {
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <AppHeader
            title="Switch Profile"
            subtitle="This profile has no email on file, so we can't look up sibling profiles."
            actionLabel="Back"
            onAction={() => navigation.goBack()}
          />
          <EmptyState
            title="No email on this profile"
            subtitle="Add an email to your profile on the OSSFlix server, or sign out and sign back in as a different profile."
          />
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppHeader
          title="Switch Profile"
          subtitle={`Profiles on this server for ${email}.`}
          actionLabel="Back"
          onAction={() => navigation.goBack()}
        />

        {profiles.length === 0 ? (
          <EmptyState
            title="No other profiles"
            subtitle="Only one profile is registered with this email on this server."
          />
        ) : null}

        {profiles.map((profile) => {
          const isCurrent = profile.id === currentProfile?.id;
          const isSelected = profile.id === selected?.id;
          const avatar = resolveAssetUrl(profile.image_path);
          return (
            <View key={profile.id} style={styles.cardWrap}>
              <Pressable
                onPress={() => handleSelect(profile)}
                style={({ pressed }) => [styles.card, isSelected && styles.cardActive, pressed && styles.cardPressed]}
              >
                <View style={styles.avatarWrap}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatarImage} />
                  ) : (
                    <View style={[styles.avatarImage, styles.avatarFallback]}>
                      <Feather name="user" size={22} color={colors.primaryText} />
                    </View>
                  )}
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.name} numberOfLines={1}>
                    {profile.name}
                  </Text>
                  <View style={styles.metaRow}>
                    {isCurrent ? (
                      <View style={[styles.metaPill, styles.metaPillCurrent]}>
                        <Text style={styles.metaPillLabel}>Current</Text>
                      </View>
                    ) : null}
                    <Feather name={profile.has_password ? "lock" : "unlock"} size={12} color={colors.textMuted} />
                    <Text style={styles.meta}>
                      {profile.has_password ? "Password protected" : "Needs password setup"}
                    </Text>
                  </View>
                </View>
                <Feather
                  name={isCurrent ? "check" : isSelected ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={isCurrent ? colors.accentText : colors.textSoft}
                />
              </Pressable>

              {isSelected ? (
                <View style={styles.passwordWrap}>
                  <Text style={styles.passwordLabel}>
                    {needsSetPassword ? "Set a password for this profile" : `Enter ${profile.name}'s password`}
                  </Text>
                  <PasswordField value={password} onChangeText={setPassword} placeholder="Password" />
                  <Pressable
                    onPress={handleSubmit}
                    disabled={submitting}
                    style={[styles.primaryButton, submitting && styles.primaryButtonDisabled]}
                  >
                    <View style={styles.primaryButtonContent}>
                      <Feather name={needsSetPassword ? "lock" : "log-in"} size={16} color={colors.primaryText} />
                      <Text style={styles.primaryLabel}>
                        {submitting
                          ? "Switching..."
                          : needsSetPassword
                            ? "Set Password & Switch"
                            : "Switch to this Profile"}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  cardWrap: {
    marginBottom: 12,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardActive: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceAccent,
  },
  cardPressed: {
    backgroundColor: colors.surfaceAccent,
  },
  avatarWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceAccent,
  },
  avatarFallback: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  metaPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: colors.border,
  },
  metaPillCurrent: {
    backgroundColor: colors.primary,
  },
  metaPillLabel: {
    color: colors.primaryText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  passwordWrap: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 10,
  },
  passwordLabel: {
    color: colors.textSoft,
    fontSize: 13,
    fontWeight: "700",
  },
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.55,
  },
  primaryButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryLabel: {
    color: colors.primaryText,
    fontSize: 15,
    fontWeight: "800",
  },
});
