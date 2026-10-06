import { describe, expect, it } from "vitest";
import { boardMatcher } from "@/server/services/deck";
import { ffmpegArgs, fitFontSize, videoTimeline } from "./social";

describe("Social-Media-Medien", () => {
  it("verkleinert lange Schlagzeilen", () => {
    expect(fitFontSize("Kurz", 920, 4, 92, 56)).toBe(92);
    expect(fitFontSize("Ein sehr langer Titel ".repeat(6), 920, 4, 92, 56)).toBeLessThan(92);
    expect(fitFontSize("x".repeat(2000), 920, 4, 92, 56)).toBe(56);
  });

  it("plant Tafeln mit Überblendung", () => {
    const t = videoTimeline(3);
    expect(t.durations).toEqual([3, 4, 4, 4, 3.5]);
    expect(t.offsets).toEqual([2.5, 6, 9.5, 13]);
    expect(t.total).toBe(16.5);
    const args = ffmpegArgs(["a.png", "b.png", "c.png"], "out.mp4");
    expect(args.join(" ")).toContain("xfade=transition=slideleft:duration=0.5:offset=2.5");
    expect(args.join(" ")).toContain("xfade=transition=fade");
    expect(args.at(-1)).toBe("out.mp4");
  });

  it("filtert Deck-Boards nach Titel oder ID", () => {
    const m = boardMatcher("BBR Seckenheim");
    expect(m({ id: 7, title: "bbr seckenheim" })).toBe(true);
    expect(m({ id: 8, title: "Privat" })).toBe(false);
    expect(boardMatcher("8, 9")({ id: 8, title: "x" })).toBe(true);
    expect(boardMatcher("")({ id: 1, title: "x" })).toBe(true);
  });
});
