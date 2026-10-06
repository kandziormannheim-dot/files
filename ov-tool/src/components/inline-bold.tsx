import { boldSegments } from "@/lib/bbr-card";

/** Text mit einfachem Markdown-Fettdruck (**…**) anzeigen, z. B. Kurzfassungen aus „BBR-Anliegen“. */
export function InlineBold({ text }: { text: string }) {
  return (
    <>
      {boldSegments(text).map((s, i) => (s.bold ? <strong key={i}>{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </>
  );
}
