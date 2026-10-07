import React from "react";
import { Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { waitFor } from "@testing-library/react-native";

import { REFRESH_AFTER_MS, refreshVisibleQueries } from "../../src/providers/AppProviders";
import { renderWithQuery } from "../utils/renderWithQuery";

function Library({ fetchLibrary }: { fetchLibrary: () => Promise<string> }) {
  const query = useQuery({ queryKey: ["library"], queryFn: fetchLibrary });
  return <Text>{query.data ?? "loading"}</Text>;
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("refreshVisibleQueries", () => {
  async function renderLoaded() {
    const fetchLibrary = jest.fn(async () => "titles");
    const utils = renderWithQuery(<Library fetchLibrary={fetchLibrary} />);
    await utils.findByText("titles");
    return { ...utils, fetchLibrary };
  }

  it("refetches on-screen data once it is older than the refresh window", async () => {
    const { client, fetchLibrary } = await renderLoaded();
    const now = Date.now();
    jest.spyOn(Date, "now").mockReturnValue(now + REFRESH_AFTER_MS + 1);
    refreshVisibleQueries(client, "Home");
    await waitFor(() => expect(fetchLibrary).toHaveBeenCalledTimes(2));
  });

  it("leaves fresh data alone", async () => {
    const { client, fetchLibrary } = await renderLoaded();
    refreshVisibleQueries(client, "Home");
    expect(fetchLibrary).toHaveBeenCalledTimes(1);
  });

  it("does nothing while the player is up", async () => {
    const { client, fetchLibrary } = await renderLoaded();
    jest.spyOn(Date, "now").mockReturnValue(Date.now() + REFRESH_AFTER_MS + 1);
    refreshVisibleQueries(client, "Player");
    expect(fetchLibrary).toHaveBeenCalledTimes(1);
  });
});
