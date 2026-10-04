"use client";

import type { Link as LinkRecord, LinkCategory } from "@prisma/client";
import { ExternalLink, Pencil, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { SortableList } from "@/components/sortable-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LINK_CATEGORY_LABELS, LINK_CATEGORY_ORDER } from "@/lib/labels";
import { reorderLinksAction } from "./actions";

type Item = LinkRecord & { editable: boolean };

export function LinksBrowser({ links, canSort }: { links: Item[]; canSort: boolean }) {
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState(false);
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      q
        ? links.filter((l) =>
            [l.title, l.url, l.description, l.accessNote, LINK_CATEGORY_LABELS[l.category]].some((t) =>
              t.toLowerCase().includes(q),
            ),
          )
        : links,
    [links, q],
  );
  const groups = LINK_CATEGORY_ORDER.map((c) => ({ category: c, items: filtered.filter((l) => l.category === c) })).filter(
    (g) => g.items.length,
  );

  async function reorder(category: LinkCategory, ids: string[]) {
    const res = await reorderLinksAction(category, ids);
    if (res && !res.ok) toast.error(res.error);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-400" />
          <Input
            type="search"
            placeholder="Suchen …"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
            aria-label="Links durchsuchen"
          />
        </div>
        {canSort ? (
          <Button variant={sorting ? "secondary" : "outline"} onClick={() => setSorting((s) => !s)} disabled={!!q}>
            {sorting ? "Sortieren beenden" : "Sortieren"}
          </Button>
        ) : null}
      </div>
      {groups.length === 0 ? <p className="text-neutral-600">Keine Links gefunden.</p> : null}
      {groups.map(({ category, items }) => (
        <section key={category}>
          <h2 className="mb-2 text-sm font-semibold tracking-wide text-neutral-600 uppercase">
            {LINK_CATEGORY_LABELS[category]}
          </h2>
          <SortableList
            items={items}
            disabled={!sorting || !!q}
            onReorder={(ids) => reorder(category, ids)}
            className="flex flex-col gap-2"
            renderItem={(l) => <LinkCard link={l} />}
          />
        </section>
      ))}
    </div>
  );
}

function LinkCard({ link }: { link: Item }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-white p-3">
      <div className="min-w-0 flex-1">
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-akzent-dunkel hover:underline"
        >
          {link.title}
          <ExternalLink className="size-3.5" aria-hidden />
        </a>
        <div className="truncate text-xs text-neutral-500">{link.url}</div>
        {link.description ? <p className="mt-1 text-sm">{link.description}</p> : null}
        {link.accessNote ? <p className="mt-1 text-sm text-neutral-600">Zugang über: {link.accessNote}</p> : null}
        {link.editorialNote ? <p className="mt-1 text-sm text-neutral-600">Redaktion: {link.editorialNote}</p> : null}
      </div>
      {link.editable ? (
        <Button asChild variant="ghost" size="icon" aria-label={`${link.title} bearbeiten`}>
          <Link href={`/links/${link.id}`}>
            <Pencil />
          </Link>
        </Button>
      ) : null}
    </div>
  );
}
