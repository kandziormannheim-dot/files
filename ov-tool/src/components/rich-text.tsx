/** Einfache Textformatierung: Leerzeile = Absatz, „## “ = Zwischenüberschrift, „- “ = Aufzählung, **fett**. Kein HTML. */
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <span key={i}>{part}</span>,
  );
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, "\n").split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        if (b.startsWith("## ")) return <h2 key={i} className="mt-6 mb-2 text-xl font-extrabold text-rhoendorf">{inline(b.slice(3))}</h2>;
        const lines = b.split("\n");
        if (lines.every((l) => /^[-•]\s/.test(l))) {
          return (
            <ul key={i} className="my-3 list-disc pl-6">
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^[-•]\s/, ""))}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="my-3 whitespace-pre-line leading-relaxed">
            {inline(b)}
          </p>
        );
      })}
    </div>
  );
}
