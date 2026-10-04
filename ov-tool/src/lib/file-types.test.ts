import { describe, expect, it } from "vitest";
import { sniffType } from "./file-types";

describe("sniffType", () => {
  it("erkennt PNG, JPEG, PDF und lehnt Text ab", () => {
    expect(sniffType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d]))).toBe("image/png");
    expect(sniffType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffType(new TextEncoder().encode("<svg>"))).toBeNull();
  });
});
