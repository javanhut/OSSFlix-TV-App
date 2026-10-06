import { useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, View } from "react-native";
import { Pressable } from "../components/FocusPressable";
import { useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { api } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { colors } from "../theme/colors";
import { useAllowRotation } from "../hooks/useAllowRotation";
import { useSessionStore } from "../state/session";
import type { RootStackParamList } from "../navigation/RootNavigator";

export function ProfileScreen() {
  useAllowRotation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const profile = useSessionStore((state) => state.profile);
  const serverUrl = useSessionStore((state) => state.serverUrl);
  const clearAuth = useSessionStore((state) => state.clearAuth);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const handleLogout = async () => {
    setSignOutOpen(false);
    try {
      await api.mobileLogout();
    } catch {
      // best-effort revoke
    }
    clearAuth();
    queryClient.clear();
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <AppHeader title="Profile" subtitle="Manage your session and preferences." />

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Feather name="user" size={28} color={colors.primaryText} />
          </View>
          <View style={styles.info}>
            <Text style={styles.name} numberOfLines={1}>
              {profile?.name || "Guest"}
            </Text>
            {profile?.email ? (
              <Text style={styles.email} numberOfLines={1}>
                {profile.email}
              </Text>
            ) : null}
            {serverUrl ? (
              <Text style={styles.server} numberOfLines={1}>
                {serverUrl}
              </Text>
            ) : null}
          </View>
        </View>

        {profile?.email ? (
          <Pressable
            style={({ pressed }) => [styles.switchButton, pressed && styles.switchButtonPressed]}
            onPress={() => navigation.navigate("SwitchProfile")}
          >
            <Feather name="users" size={18} color={colors.primaryText} />
            <Text style={styles.switchLabel}>Switch Profile</Text>
          </Pressable>
        ) : null}

        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
          onPress={() => setSignOutOpen(true)}
        >
          <Feather name="log-out" size={18} color={colors.text} />
          <Text style={styles.signOutLabel}>Sign Out</Text>
        </Pressable>
      </ScrollView>

      <Modal visible={signOutOpen} transparent animationType="fade" onRequestClose={() => setSignOutOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSignOutOpen(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Sign out?</Text>
            <Text style={styles.modalBody}>
              This ends your mobile session on this device. You'll need to sign in again to stream.
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={({ pressed }) => [styles.modalCancel, pressed && styles.modalCancelPressed]}
                onPress={() => setSignOutOpen(false)}
              >
                <Text style={styles.modalCancelLabel}>Cancel</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.modalConfirm, pressed && styles.modalConfirmPressed]}
                onPress={() => void handleLogout()}
              >
                <Feather name="log-out" size={16} color={colors.primaryText} />
                <Text style={styles.modalConfirmLabel}>Sign Out</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: 18,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 24,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
  },
  name: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  email: {
    color: colors.textSoft,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
  },
  server: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  switchButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    marginBottom: 12,
  },
  switchButtonPressed: {
    backgroundColor: colors.primaryPressed,
  },
  switchLabel: {
    color: colors.primaryText,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceElevated,
  },
  signOutPressed: {
    backgroundColor: colors.surfaceAccent,
  },
  signOutLabel: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(3,6,14,0.7)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 22,
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
  },
  modalBody: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  modalActions: {
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  modalCancel: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAccent,
  },
  modalCancelPressed: {
    backgroundColor: colors.border,
  },
  modalCancelLabel: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 14,
  },
  modalConfirm: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  modalConfirmPressed: {
    backgroundColor: colors.primaryPressed,
  },
  modalConfirmLabel: {
    color: colors.primaryText,
    fontWeight: "800",
    fontSize: 14,
  },
});
