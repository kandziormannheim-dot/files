"use client";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="rounded bg-[#2d3c4b] px-3 py-1 text-white">
      Drucken
    </button>
  );
}
