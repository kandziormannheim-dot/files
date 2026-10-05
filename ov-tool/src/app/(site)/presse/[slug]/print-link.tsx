"use client";

export function PrintLink() {
  return (
    <button type="button" onClick={() => window.print()} className="no-print self-start text-sm text-rhoendorf underline">
      Drucken / als PDF speichern
    </button>
  );
}
