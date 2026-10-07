import { act, renderHook } from "@testing-library/react-native";
import { useTVPreferredFocus } from "../../src/utils/tv";

describe("useTVPreferredFocus", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("turns on one frame after mount, so Android sees a change on an attached view", () => {
    const { result } = renderHook(() => useTVPreferredFocus(true));
    expect(result.current).toBe(false);
    act(() => jest.runOnlyPendingTimers());
    expect(result.current).toBe(true);
  });

  it("drops immediately when no longer wanted and re-arms when wanted again", () => {
    const { result, rerender } = renderHook(({ wanted }: { wanted: boolean }) => useTVPreferredFocus(wanted), {
      initialProps: { wanted: true },
    });
    act(() => jest.runOnlyPendingTimers());
    rerender({ wanted: false });
    expect(result.current).toBe(false);
    rerender({ wanted: true });
    expect(result.current).toBe(false);
    act(() => jest.runOnlyPendingTimers());
    expect(result.current).toBe(true);
  });

  it("stays off when not wanted", () => {
    const { result } = renderHook(() => useTVPreferredFocus(false));
    act(() => jest.runOnlyPendingTimers());
    expect(result.current).toBe(false);
  });
});
