const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

jest.mock("../../src/downloads/downloadManager", () => ({
  deleteDownload: jest.fn(),
  pauseDownload: jest.fn(),
  resumeDownload: jest.fn(),
}));

import { Alert } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";

import { DownloadsScreen } from "../../src/screens/DownloadsScreen";
import { deleteDownload, pauseDownload, resumeDownload } from "../../src/downloads/downloadManager";
import { useDownloadsStore } from "../../src/state/downloads";
import { useSessionStore } from "../../src/state/session";
import type { DownloadItem, DownloadStatus } from "../../src/types/downloads";

function item(id: string, status: DownloadStatus, overrides: Partial<DownloadItem> = {}): DownloadItem {
  return {
    id,
    src: `/media/${id}.mkv`,
    audioIndex: 0,
    dirPath: "shows/Foo",
    title: "Foo",
    episodeLabel: `S1 E${id}`,
    profileId: 1,
    status,
    progress: status === "completed" ? 1 : 0.5,
    fileUri: status === "completed" ? `file:///d/${id}.mp4` : undefined,
    createdAt: Number(id) || 1,
    ...overrides,
  };
}

beforeEach(() => {
  mockNavigate.mockReset();
  (deleteDownload as jest.Mock).mockReset();
  (pauseDownload as jest.Mock).mockReset();
  (resumeDownload as jest.Mock).mockReset();
  useSessionStore.setState({
    bootstrapped: true,
    serverUrl: "http://media.local",
    token: "t",
    profile: { id: 1, name: "Ada" } as never,
    selectedProfile: null,
  });
  useDownloadsStore.setState({ bootstrapped: true, items: {}, progress: {} });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe("DownloadsScreen", () => {
  it("renders the empty state when there are no downloads", () => {
    const { getByText } = render(<DownloadsScreen />);
    expect(getByText("No downloads yet")).toBeTruthy();
  });

  it("groups downloads by title and shows each status", () => {
    useDownloadsStore.setState({
      items: {
        "1": item("1", "completed"),
        "2": item("2", "downloading"),
        "3": item("3", "paused", { progress: -1 }),
        "4": item("4", "failed"),
        b: item("b", "completed", { dirPath: "movies/Bar", title: "Bar", episodeLabel: undefined }),
      },
      progress: { "1": { current_time: 10, duration: 42, updatedAt: 1 } },
    });
    const { getByText, getAllByText } = render(<DownloadsScreen />);
    expect(getByText("Foo")).toBeTruthy();
    // "Bar" appears twice: the group heading and the movie's row (no episode label).
    expect(getAllByText("Bar").length).toBe(2);
    expect(getByText("Downloaded · Resume")).toBeTruthy();
    expect(getByText("Downloading 50%")).toBeTruthy();
    expect(getByText("Paused")).toBeTruthy();
    expect(getByText("Failed — tap to retry")).toBeTruthy();
  });

  it("hides downloads that belong to a different profile", () => {
    useDownloadsStore.setState({
      items: { x: item("x", "completed", { profileId: 999 }) },
      progress: {},
    });
    const { queryByText } = render(<DownloadsScreen />);
    expect(queryByText("Foo")).toBeNull();
    expect(queryByText("No downloads yet")).toBeTruthy();
  });

  it("plays a completed download offline", () => {
    useDownloadsStore.setState({
      items: { "1": item("1", "completed") },
      progress: { "1": { current_time: 7, duration: 42, updatedAt: 1 } },
    });
    const { getByLabelText } = render(<DownloadsScreen />);
    fireEvent.press(getByLabelText("Play S1 E1"));
    expect(mockNavigate).toHaveBeenCalledWith(
      "Player",
      expect.objectContaining({ offline: true, startIndex: 0, initialTime: 7, videos: ["file:///d/1.mp4"] }),
    );
  });

  it("pauses an in-progress download", () => {
    useDownloadsStore.setState({ items: { "2": item("2", "downloading") }, progress: {} });
    const { getByLabelText } = render(<DownloadsScreen />);
    fireEvent.press(getByLabelText("Pause download"));
    expect(pauseDownload).toHaveBeenCalledWith("2");
  });

  it("resumes a paused download when the row is tapped", () => {
    useDownloadsStore.setState({ items: { "3": item("3", "paused") }, progress: {} });
    const { getByLabelText } = render(<DownloadsScreen />);
    fireEvent.press(getByLabelText("Paused"));
    expect(resumeDownload).toHaveBeenCalledWith("3");
  });

  it("deletes a download after confirmation", () => {
    jest.spyOn(Alert, "alert").mockImplementation((_t, _m, buttons) => {
      buttons?.find((b) => b.style === "destructive")?.onPress?.();
    });
    useDownloadsStore.setState({ items: { "1": item("1", "completed") }, progress: {} });
    const { getByLabelText } = render(<DownloadsScreen />);
    fireEvent.press(getByLabelText("Delete download"));
    expect(deleteDownload).toHaveBeenCalledWith("1");
  });
});
