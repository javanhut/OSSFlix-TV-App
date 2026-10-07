import React from "react";
import { StyleSheet } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { EpisodeRow } from "../../src/components/EpisodeRow";

const parsed = { season: 1, episode: 2, title: "The Bank Job", ext: "mkv" };

describe("EpisodeRow", () => {
  it("renders the Episode N label and title for a parsed episode", () => {
    const { getByText } = render(<EpisodeRow parsed={parsed} fallbackLabel="ignored" onPlay={() => {}} />);
    expect(getByText("Episode 2")).toBeTruthy();
    expect(getByText("The Bank Job")).toBeTruthy();
  });

  it("titles an untitled episode Episode N, with the season above so it doesn't repeat", () => {
    const untitled = { season: 1, episode: 1, title: "", ext: "mkv" };
    const { getByText } = render(<EpisodeRow parsed={untitled} fallbackLabel="-" onPlay={() => {}} />);
    expect(getByText("Season 1")).toBeTruthy();
    expect(getByText("Episode 1")).toBeTruthy();
  });

  it("lights the whole card up while the row has D-pad focus", () => {
    const { getByLabelText, getByTestId } = render(<EpisodeRow parsed={parsed} fallbackLabel="-" onPlay={() => {}} />);
    const borderColor = () => StyleSheet.flatten(getByTestId("episode-row").props.style).borderColor;
    const unfocused = borderColor();
    fireEvent(getByLabelText("Play Episode 2"), "focus");
    expect(borderColor()).toBe("#60a5fa");
    fireEvent(getByLabelText("Play Episode 2"), "blur");
    expect(borderColor()).toBe(unfocused);
  });

  it("treats an episode stopped in the credits (>= 90%) as watched", () => {
    const { getByText, queryByLabelText } = render(
      <EpisodeRow
        parsed={parsed}
        fallbackLabel="-"
        progress={{ current_time: 1332, duration: 1420 }}
        onPlay={() => {}}
        onRestart={() => {}}
      />,
    );
    expect(getByText("Watched · 23:40")).toBeTruthy();
    expect(queryByLabelText("Play from beginning")).toBeNull();
  });

  it('renders "Movie" badge and fallback label when parsed is null', () => {
    const { getByText } = render(<EpisodeRow parsed={null} fallbackLabel="Random Clip" onPlay={() => {}} />);
    expect(getByText("Movie")).toBeTruthy();
    expect(getByText("Random Clip")).toBeTruthy();
  });

  it("shows in-progress meta (current / total) and a restart button when restart handler provided", () => {
    const onPlay = jest.fn();
    const onRestart = jest.fn();
    const { getByText, getByLabelText } = render(
      <EpisodeRow
        parsed={parsed}
        fallbackLabel="-"
        progress={{ current_time: 65, duration: 1800 }}
        onPlay={onPlay}
        onRestart={onRestart}
      />,
    );
    expect(getByText("1:05 / 30:00 · 29 min left")).toBeTruthy();
    const restart = getByLabelText("Play from beginning");
    fireEvent.press(restart);
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("marks a finished episode watched and omits the restart button", () => {
    const { getByText, queryByLabelText } = render(
      <EpisodeRow
        parsed={parsed}
        fallbackLabel="-"
        progress={{ current_time: 1800, duration: 1800 }}
        onPlay={() => {}}
        onRestart={() => {}}
      />,
    );
    expect(getByText("Watched · 30:00")).toBeTruthy();
    expect(queryByLabelText("Play from beginning")).toBeNull();
  });

  it("renders no meta and no restart when there is no progress data", () => {
    const { queryByLabelText, queryByText } = render(
      <EpisodeRow parsed={parsed} fallbackLabel="-" onPlay={() => {}} onRestart={() => {}} />,
    );
    expect(queryByLabelText("Play from beginning")).toBeNull();
    expect(queryByText(/\d+:\d{2}/)).toBeNull();
  });

  it("fires onPlay when the row is pressed", () => {
    const onPlay = jest.fn();
    const { getByLabelText } = render(<EpisodeRow parsed={parsed} fallbackLabel="-" onPlay={onPlay} />);
    fireEvent.press(getByLabelText("Play Episode 2"));
    expect(onPlay).toHaveBeenCalledTimes(1);
  });
});
