import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
} from "@expo-google-fonts/inter";
import { Sora_600SemiBold, Sora_700Bold, Sora_800ExtraBold } from "@expo-google-fonts/sora";

export const fontAssets = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  Inter_800ExtraBold,
  Sora_600SemiBold,
  Sora_700Bold,
  Sora_800ExtraBold,
};

// Android resolves custom fonts by family name, so each weight is its own family.
// Don't combine these with fontWeight.
export const fonts = {
  body: "Inter_400Regular",
  bodyMedium: "Inter_500Medium",
  bodySemiBold: "Inter_600SemiBold",
  bodyBold: "Inter_700Bold",
  bodyExtraBold: "Inter_800ExtraBold",
  displaySemiBold: "Sora_600SemiBold",
  displayBold: "Sora_700Bold",
  display: "Sora_800ExtraBold",
};
