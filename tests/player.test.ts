import { describe, it, expect } from "vitest";
import {
  formatTime,
  nextTrack,
  shortcut,
  seekDelta,
  parseTimeString,
} from "../src/player";
describe("media controls", () => {
  it("formats duration without wrapping hours", () => {
    expect(formatTime(3661000)).toBe("1:01:01");
    expect(formatTime(-30)).toBe("0:00");
    expect(formatTime(NaN)).toBe("0:00");
    expect(formatTime(90000)).toBe("1:30");
  });
  it("uses track IDs rather than array offsets", () => {
    const tracks = [
      { id: -1, name: "Disable" },
      { id: 5, name: "English" },
      { id: 12, name: "日本語" },
    ];
    expect(nextTrack(tracks, 5)).toBe(12);
    expect(nextTrack(tracks, 12)).toBe(-1);
    expect(nextTrack([], 0)).toBe(null);
  });
  it("keeps native open shortcuts distinct from playback keys", () => {
    expect(shortcut("o", true, false)).toBe("open");
    expect(shortcut("O", true, true)).toBe("append");
    expect(shortcut("s", true, false)).toBe(null);
    expect(shortcut(" ", false, false)).toBe("toggle");
    expect(shortcut("Escape", false, false)).toBe("exit_fullscreen");
  });
  it("uses VLC seek intervals with modifier keys", () => {
    expect(seekDelta(shortcut("ArrowLeft", false, true)!)).toBe(-3000);
    expect(seekDelta(shortcut("ArrowRight", false, false, true)!)).toBe(10000);
    expect(seekDelta(shortcut("ArrowLeft", true, false)!)).toBe(-60000);
    expect(seekDelta(shortcut("ArrowRight", true, false, true)!)).toBe(300000);
    expect(shortcut("p", true, false)).toBe("preferences");
    expect(shortcut("S", false, true)).toBe("snapshot");
    expect(shortcut("m", false, false, true)).toBe(null);
  });
  it("rejects malformed or unbounded jump timestamps", () => {
    expect(parseTimeString("1:02:03")).toBe(3723000);
    expect(parseTimeString("90")).toBe(90000);
    expect(parseTimeString("1:02.5")).toBe(62500);
    for (const value of [
      "Infinity",
      "1e9",
      "1::2",
      "1:99",
      "-1",
      "1:2:3:4",
      "999999999999999999999999",
    ])
      expect(parseTimeString(value)).toBe(null);
  });
});
