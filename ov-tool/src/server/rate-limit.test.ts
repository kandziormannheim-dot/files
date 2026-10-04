import { beforeEach, describe, expect, it } from "vitest";
import { rateLimit, resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(resetRateLimits);
  it("sperrt nach dem Limit und gibt nach Ablauf des Fensters wieder frei", () => {
    const t = 1_000_000;
    for (let i = 0; i < 3; i++) expect(rateLimit("k", 3, 1000, t + i)).toBe(true);
    expect(rateLimit("k", 3, 1000, t + 10)).toBe(false);
    expect(rateLimit("k", 3, 1000, t + 2000)).toBe(true);
  });
});
