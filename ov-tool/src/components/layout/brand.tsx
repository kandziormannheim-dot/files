import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Logo des OV (Datei von cdu-sf.de) mit Absenderzeile nach CDU-Manual („Regionalisierung“: Inter Regular, Versalien).
 * Das Logo steht immer auf weißem Grund mit Schutzraum.
 */
export function Brand({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link href="/" className={cn("block", className)} aria-label="Zur Übersicht – CDU Seckenheim-Friedrichsfeld">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand/cdu-logo.svg" alt="CDU" className={compact ? "h-8 w-auto" : "h-12 w-auto"} />
      <span className={cn("block font-normal uppercase tracking-[0.08em] text-rhoendorf", compact ? "text-[9px] leading-tight" : "mt-1 text-[10px] leading-snug")}>
        Seckenheim-Friedrichsfeld
      </span>
    </Link>
  );
}
