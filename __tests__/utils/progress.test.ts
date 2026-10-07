import { isProgressInProgress, isProgressWatched } from "../../src/utils/progress";

describe("progress", () => {
  it("counts the credits (>= 90%) and the last few seconds as watched", () => {
    expect(isProgressWatched({ current_time: 1332, duration: 1420 })).toBe(true);
    expect(isProgressWatched({ current_time: 1416, duration: 1420 })).toBe(true);
    expect(isProgressInProgress({ current_time: 1332, duration: 1420 })).toBe(false);
  });

  it("treats a partial watch as in progress", () => {
    expect(isProgressWatched({ current_time: 258, duration: 1420 })).toBe(false);
    expect(isProgressInProgress({ current_time: 258, duration: 1420 })).toBe(true);
  });

  it("never marks an unknown duration as watched", () => {
    expect(isProgressWatched({ current_time: 60, duration: 0 })).toBe(false);
    expect(isProgressInProgress({ current_time: 60, duration: 0 })).toBe(true);
    expect(isProgressInProgress(null)).toBe(false);
  });
});
