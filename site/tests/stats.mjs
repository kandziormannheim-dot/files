import { chromium } from "playwright";

const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const B = "http://127.0.0.1:4321";
const b = await chromium.launch({ executablePath: EXE });
let failed = 0;
const ok = (c, m) => {
  if (!c) failed++;
  console.log(`${c ? "OK  " : "FEHL"} ${m}`);
};

// --- Die Kernbedingung: ohne JavaScript vollstaendig lesbar --------------
{
  const ctx = await b.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(B + "/", { waitUntil: "domcontentloaded" });
  const werte = await p.$$eval(".proof__value", (els) =>
    els.map((e) => e.textContent.replace(/\s+/g, " ").trim()),
  );
  ok(werte.length === 3, `drei Zahlen vorhanden -> ${werte.length}`);
  ok(
    werte.every((w) => w.length > 0 && w !== "0"),
    `ohne JavaScript lesbar -> ${JSON.stringify(werte)}`,
  );
  await ctx.close();
}

// --- Mit JavaScript: Endwerte stimmen nach der Animation -----------------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.querySelector("#proof").scrollIntoView());
  await p.waitForTimeout(1600);
  const sichtbar = await p.$$eval("[data-count-to]", (els) =>
    els.map((e) => ({ text: e.textContent.trim(), ziel: e.dataset.countTo })),
  );
  ok(
    sichtbar.every((s) => s.text === s.ziel),
    `Endwerte exakt -> ${JSON.stringify(sichtbar)}`,
  );
  await p.close();
}

// --- Bewegungsreduktion: kein Zaehlen, Werte sofort korrekt -------------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.emulateMedia({ reducedMotion: "reduce" });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.querySelector("#proof").scrollIntoView());
  await p.waitForTimeout(120); // absichtlich kuerzer als jede Animation
  const sofort = await p.$$eval("[data-count-to]", (els) =>
    els.map((e) => e.textContent.trim() === e.dataset.countTo),
  );
  ok(sofort.every(Boolean), "bei Bewegungsreduktion sofort der Endwert");
  await p.close();
}

// --- Mobil: kein Zaehlen ------------------------------------------------
{
  const p = await b.newPage({ viewport: { width: 375, height: 667 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  await p.evaluate(() => document.querySelector("#proof").scrollIntoView());
  await p.waitForTimeout(120);
  const sofort = await p.$$eval("[data-count-to]", (els) =>
    els.map((e) => e.textContent.trim() === e.dataset.countTo),
  );
  ok(sofort.every(Boolean), "auf 375px sofort der Endwert, keine Animation");
  await p.close();
}

// --- Vorlesesoftware bekommt genau einen Wert je Zahl -------------------
{
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const versteckt = await p.$$eval("[data-count-to]", (els) =>
    els.map((e) => e.getAttribute("aria-hidden")),
  );
  ok(versteckt.every((v) => v === "true"), "laufende Ziffer ist fuer Vorlesesoftware ausgeblendet");

  // Entscheidend ist nicht der Text im DOM, sondern was im Zugaenglichkeits-
  // baum ankommt: Die optisch weggeblendete Zweitfassung steht dort einmal,
  // die laufende Ziffer gar nicht.
  const baum = await p.locator("#proof").ariaSnapshot();
  console.log("     Zugaenglichkeitsbaum:\n" + baum.split("\n").map((z) => "       " + z).join("\n"));
  const fuenfzehnen = (baum.match(/\b15\b/g) ?? []).length;
  const fuenfziger = (baum.match(/\b50\b/g) ?? []).length;
  ok(
    fuenfzehnen === 1 && fuenfziger === 1,
    `jede Zahl genau einmal im Zugaenglichkeitsbaum -> 15: ${fuenfzehnen}x, 50: ${fuenfziger}x`,
  );
  await p.close();
}

// --- Struktur und Breiten ------------------------------------------------
for (const w of [320, 375, 768, 1280, 1920]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const over = await p.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  const spalten = await p.evaluate(
    () => getComputedStyle(document.querySelector(".proof__grid")).gridTemplateColumns.split(" ").length,
  );
  ok(!over, `${w}px: kein horizontales Scrollen (${spalten} Spalte(n))`);
  await p.close();
}

// --- Hero bleibt trotz neuem Bereich in der ersten Bildschirmhoehe -------
{
  const p = await b.newPage({ viewport: { width: 375, height: 667 } });
  await p.goto(B + "/", { waitUntil: "networkidle" });
  const unten = await p.evaluate(() =>
    Math.round(document.querySelector(".hero__actions").getBoundingClientRect().bottom),
  );
  ok(unten <= 667, `Anfrage-Knopf weiterhin bei ${unten}px sichtbar`);
  await p.close();
}

await b.close();
console.log(failed === 0 ? "\nAlle Pruefungen bestanden." : `\n${failed} Pruefung(en) fehlgeschlagen.`);
process.exit(failed === 0 ? 0 : 1);
