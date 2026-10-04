import { describe, expect, it } from "vitest";
import { parseVtt } from "./transcript-text";

describe("parseVtt", () => {
  it("liest Teams-VTT mit Sprechern und fasst Beiträge zusammen", () => {
    const vtt = `WEBVTT

3f1c2a9e-1234-4abc-9def-0123456789ab/12-0
00:00:01.000 --> 00:00:04.000
<v Max Muster>Ich eröffne die Sitzung.</v>

00:00:04.500 --> 00:00:06.000
<v Max Muster>Wir sind beschlussfähig.</v>

00:00:07.000 --> 00:00:09.000
<v Erika Beispiel>Kein Bericht aus dem BBR.</v>`;
    expect(parseVtt(vtt)).toBe("Max Muster: Ich eröffne die Sitzung. Wir sind beschlussfähig.\nErika Beispiel: Kein Bericht aus dem BBR.");
  });

  it("liest Zoom-VTT mit „Name: Text“", () => {
    const vtt = "WEBVTT\n\n1\n00:00:01.000 --> 00:00:02.000\nHans Test: Hallo zusammen\n";
    expect(parseVtt(vtt)).toBe("Hans Test: Hallo zusammen");
  });
});
