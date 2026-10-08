"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded bg-[#2d3c4b] px-3 py-1 text-white">
      Drucken
    </button>
  );
}

/** Formatauswahl: merkt sich die Wahl im Browser und lädt die Vorschau sofort neu. */
export function FormatSelect({ value, options }: { value: string; options: { key: string; name: string; hint: string }[] }) {
  return (
    <select
      name="format"
      defaultValue={value}
      className="rounded border px-2 py-1"
      onChange={(e) => {
        document.cookie = `labelFormat=${encodeURIComponent(e.target.value)}; path=/inventory; max-age=31536000; samesite=lax`;
        e.target.form?.requestSubmit();
      }}
    >
      {options.map((o) => (
        <option key={o.key} value={o.key} title={o.hint}>
          {o.name}
        </option>
      ))}
    </select>
  );
}
