import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Pressable } from "../components/FocusPressable";
import { Feather } from "@expo/vector-icons";

import { api } from "../api/client";
import { AppHeader } from "../components/AppHeader";
import { PasswordField } from "../components/PasswordField";
import { useSessionStore } from "../state/session";
import { colors } from "../theme/colors";

export function RegisterScreen() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const setAuthenticatedSession = useSessionStore((state) => state.setAuthenticatedSession);

  const submit = async () => {
    try {
      setSubmitting(true);
      const response = await api.mobileRegister(name.trim(), email.trim(), password);
      if (!response?.token || !response?.profile) {
        throw new Error("Server did not return a valid session. Please try again.");
      }
      setAuthenticatedSession(response.token, response.profile);
    } catch (error) {
      Alert.alert("Registration failed", error instanceof Error ? error.message : "Unable to create the profile.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <AppHeader
          title="Create profile"
          subtitle="Register a new mobile-capable Reelscape profile on the connected server."
        />
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Profile name"
          placeholderTextColor={colors.textDim}
          style={styles.input}
        />
        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.textDim}
          autoCapitalize="none"
          style={styles.input}
        />
        <PasswordField value={password} onChangeText={setPassword} placeholder="Password" />
        <Pressable onPress={submit} disabled={submitting} style={styles.button}>
          <View style={styles.buttonContent}>
            <Feather name="user-plus" size={18} color={colors.primaryText} />
            <Text style={styles.buttonLabel}>{submitting ? "Creating..." : "Create Account"}</Text>
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
    gap: 14,
    flexGrow: 1,
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
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
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
