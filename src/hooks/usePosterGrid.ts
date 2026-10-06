import { useWindowDimensions } from "react-native";

import { SCREEN_GUTTER } from "../components/PageHero";

export const GRID_GAP = 12;

/** Column count and card width for a full-width poster grid. */
export function usePosterGrid(): { columns: number; cardWidth: number } {
  const { width } = useWindowDimensions();
  const columns = Math.max(3, Math.floor((width - SCREEN_GUTTER * 2 + GRID_GAP) / (150 + GRID_GAP)));
  const cardWidth = Math.floor((width - SCREEN_GUTTER * 2 - GRID_GAP * (columns - 1)) / columns);
  return { columns, cardWidth };
}
