import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { EpisodeRow } from "../../src/components/EpisodeRow";

const parsed = { season: 1, episode: 2, title: "The Bank Job", ext: "mkv" };

describe("EpisodeRow", () => {
  it("renders the Episode N badge and title for a parsed episode", () => {
    const { getByText } = render(<EpisodeRow parsed={parsed} fallbackLabel="ignored" onPlay={() => {}} />);
    expect(getByText("Episode 2")).toBeTruthy();
    expect(getByText("The Bank Job")).toBeTruthy();
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
    expect(getByText("1:05 / 30:00")).toBeTruthy();
    const restart = getByLabelText("Play from beginning");
    fireEvent.press(restart);
    expect(onRestart).toHaveBeenCalledTimes(1);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("shows only total duration when the episode is watched and omits the restart button", () => {
    const { getByText, queryByLabelText } = render(
      <EpisodeRow
        parsed={parsed}
        fallbackLabel="-"
        progress={{ current_time: 1800, duration: 1800 }}
        onPlay={() => {}}
        onRestart={() => {}}
      />,
    );
    expect(getByText("30:00")).toBeTruthy();
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
