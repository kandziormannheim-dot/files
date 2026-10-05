import Link from "next/link";

/** „§“-Kontexthilfe: verlinkt eine Fundstelle direkt ins Satzungs-Tool (SPEC.md 3.14). */
export function StatuteRef({ cite, children }: { cite: string; children?: React.ReactNode }) {
  return (
    <Link
      href={`/satzung?q=${encodeURIComponent(cite)}`}
      className="whitespace-nowrap underline decoration-cadenabbia decoration-dotted underline-offset-2 hover:decoration-solid"
      title="In der Satzung nachlesen"
    >
      {children ?? cite}
    </Link>
  );
}
