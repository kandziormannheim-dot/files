import type { ReactNode } from "react";

// Öffentliche Seiten (Anmeldung, Zusage, Abstimmung): Cadenabbia-Türkis als Fläche, Logo auf weißem Grund (CDU-Manual).
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-cadenabbia px-4 py-10">
      <div className="mb-6 rounded-lg bg-white px-5 py-3 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/cdu-logo.svg" alt="CDU" className="h-12 w-auto" />
        <div className="mt-1 text-[10px] uppercase tracking-[0.08em] text-rhoendorf">Seckenheim-Friedrichsfeld</div>
      </div>
      <h1 className="mb-6 text-center text-2xl font-extrabold tracking-[-0.01em] text-white">OV-Management</h1>
      <div className="w-full max-w-md">{children}</div>
      <p className="mt-8 font-serif text-xs text-white/90">Interner Bereich des Vorstands</p>
    </div>
  );
}
