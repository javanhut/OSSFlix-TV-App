import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Pressable } from "../components/FocusPressable";
import { Feather } from "@expo/vector-icons";

import { api, normalizeServerUrl } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { useSessionStore } from "../state/session";
import { colors } from "../theme/colors";
import { useAllowRotation } from "../hooks/useAllowRotation";

export function ServerConnectScreen() {
  useAllowRotation();

  const [serverUrl, setServerUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const setConfiguredServerUrl = useSessionStore((state) => state.setServerUrl);

  const handleConnect = async () => {
    try {
      setSubmitting(true);
      const normalized = normalizeServerUrl(serverUrl);
      const info = await api.getServerInfo(normalized);
      if (!info.mobileAuth) {
        throw new Error("This server does not advertise mobile auth support.");
      }
      setConfiguredServerUrl(normalized);
    } catch (error) {
      Alert.alert("Connection failed", error instanceof Error ? error.message : "Unable to reach the server.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppHeader
          title="Connect to Reelscape"
          subtitle="Enter the base URL for your server. Example: http://192.168.1.20:3000"
        />
        <TextInput
          value={serverUrl}
          onChangeText={setServerUrl}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="http://192.168.1.20:3000"
          placeholderTextColor={colors.textDim}
          style={styles.input}
        />
        <Pressable
          onPress={handleConnect}
          disabled={submitting}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        >
          <View style={styles.buttonContent}>
            <Feather name="wifi" size={18} color={colors.primaryText} />
            <Text style={styles.buttonLabel}>{submitting ? "Testing..." : "Connect"}</Text>
          </View>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 24,
    flexGrow: 1,
    justifyContent: "center",
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
  },
  button: {
    marginTop: 16,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  buttonLabel: {
    color: colors.primaryText,
    fontSize: 16,
    fontWeight: "700",
  },
});
