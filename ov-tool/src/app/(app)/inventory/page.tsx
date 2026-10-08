import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, FileText, Package, Printer } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { formatDate } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { inventoryFacets, listItems, type InventoryFilter } from "@/server/services/inventory";
import { Scanner } from "./scanner";

export const metadata: Metadata = { title: "Inventar" };

const STATUS: Record<string, string> = { "": "Bestand", lager: "Im Lager", verliehen: "Verliehen", ausgemustert: "Ausgemustert" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; ort?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const status = (sp.status && sp.status in STATUS ? sp.status : undefined) as InventoryFilter["status"] | undefined;
  const [items, facets] = await Promise.all([listItems(user, { q: sp.q, status, location: sp.ort }), inventoryFacets(user)]);
  const now = new Date();
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ q: sp.q, status: sp.status, ort: sp.ort, ...patch }).filter(([, v]) => v) as [string, string][]);
    return `/inventory${p.size ? `?${p}` : ""}`;
  };
  const lq = new URLSearchParams(Object.entries({ q: sp.q, status: sp.status, ort: sp.ort }).filter(([, v]) => v) as [string, string][]).toString();
  const listQuery = lq ? `?${lq}` : "";
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Inventar"
          description={`${facets.total} Gegenstände im Bestand · ${facets.lent} verliehen${facets.overdue ? ` · ${facets.overdue} überfällig` : ""}`}
        />
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={`/api/inventory/list${listQuery}`} target="_blank" rel="noopener">
              <FileText className="size-4" /> PDF-Liste
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/inventory/list${listQuery}${listQuery ? "&" : "?"}inventur=1`} target="_blank" rel="noopener">
              <ClipboardCheck className="size-4" /> Inventurliste
            </a>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/inventory/labels${items.length && (sp.q || sp.ort || sp.status) ? `?ids=${items.map((i) => i.id).join(",")}` : ""}`} target="_blank">
              <Printer className="size-4" /> Etiketten
            </Link>
          </Button>
          {can(user.role, "inventory.edit") ? (
            <Button asChild>
              <Link href="/inventory/new">Anlegen</Link>
            </Button>
          ) : null}
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3">
        <Scanner />
        <form className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex" action="/inventory">
          <Input name="q" defaultValue={sp.q} placeholder="Suche: Bezeichnung, Lagerort, verliehen an …" className="col-span-2 min-w-0 sm:flex-1" />
          {sp.status ? <input type="hidden" name="status" value={sp.status} /> : null}
          <NativeSelect name="ort" defaultValue={sp.ort ?? ""} className="w-full min-w-0 sm:w-56" aria-label="Lagerort">
            <option value="">alle Lagerorte</option>
            {facets.locations.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </NativeSelect>
          <Button type="submit" variant="outline">
            Filtern
          </Button>
        </form>
        <nav className="flex flex-wrap gap-1" aria-label="Status">
          {Object.entries(STATUS).map(([k, label]) => (
            <Link
              key={k || "bestand"}
              href={qs({ status: k || undefined })}
              className={cn(
                "rounded-full border px-3 py-1 text-sm",
                (status ?? "") === k ? "border-akzent-dunkel bg-akzent-hell font-semibold text-akzent-dunkel" : "bg-white text-neutral-700",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-neutral-600">Keine Gegenstände gefunden.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 [&>li]:min-w-0">
          {items.map((i) => {
            const overdue = i.lentTo && i.lentDueAt && i.lentDueAt < now;
            return (
              <li key={i.id}>
                <Link href={`/inventory/${i.id}`}>
                  <Card className="h-full transition hover:border-akzent">
                    <CardContent className="flex gap-3 p-3">
                      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-neutral-100">
                        {i.photoPath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/inventory/${i.id}/photo`} alt="" className="size-full object-cover" loading="lazy" />
                        ) : (
                          <Package className="size-8 text-neutral-400" aria-hidden />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="truncate font-semibold">
                          {i.name}
                          {i.quantity > 1 ? <span className="font-normal text-neutral-600"> × {i.quantity}</span> : null}
                        </p>
                        <p className="font-mono text-xs text-neutral-600">{i.code}</p>
                        <p className="truncate text-neutral-600">{i.location || "Lagerort fehlt"}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {i.retiredAt ? <Badge variant="secondary">ausgemustert</Badge> : null}
                          {i.lentTo ? (
                            <Badge variant={overdue ? "destructive" : "warning"} className="whitespace-normal">
                              verliehen an {i.lentTo}
                              {i.lentDueAt ? ` bis ${formatDate(i.lentDueAt)}` : ""}
                            </Badge>
                          ) : null}
                          {i.condition === "defekt" || i.condition === "reparaturbedürftig" ? <Badge variant="destructive">{i.condition}</Badge> : null}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
