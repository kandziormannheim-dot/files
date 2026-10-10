import { describe, expect, it } from "vitest";
import { prefillChoice, prefillList, prefillText } from "./prefill";

describe("prefillText", () => {
  it("nimmt den ersten Wert, kürzt und entfernt Steuerzeichen", () => {
    expect(prefillText(["  Hallo\r\nWelt\u0007 ", "x"], 100)).toBe("Hallo\nWelt");
    expect(prefillText("abcdef", 3)).toBe("abc");
    expect(prefillText(undefined, 10)).toBe("");
  });
});

describe("prefillChoice", () => {
  it("lässt nur erlaubte Werte zu", () => {
    expect(prefillChoice("BBR", ["OV", "BBR"] as const, "OV")).toBe("BBR");
    expect(prefillChoice("XYZ", ["OV", "BBR"] as const, "OV")).toBe("OV");
  });
});

describe("prefillList", () => {
  it("filtert und entdoppelt", () => {
    expect(prefillList("facebook,instagram,foo,facebook", ["facebook", "instagram", "x"] as const, ["facebook"])).toEqual(["facebook", "instagram"]);
    expect(prefillList("", ["facebook"] as const, ["facebook"])).toEqual(["facebook"]);
  });
});
