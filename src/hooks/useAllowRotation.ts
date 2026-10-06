import { useEffect } from "react";
import * as ScreenOrientation from "expo-screen-orientation";

export function useAllowRotation() {
  useEffect(() => {
    void ScreenOrientation.unlockAsync().catch(() => {});
  }, []);
}
