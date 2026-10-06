import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/dates";
import { formatEuro } from "@/lib/money";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { ForbiddenError } from "@/server/errors";
import { listClaims, STATUS_LABELS } from "@/server/services/expenses";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Auslagen" };

const VARIANT = { ENTWURF: "secondary", EINGEREICHT: "warning", VERSENDET: "default", ERLEDIGT: "success", ABGELEHNT: "destructive" } as const;
const PAYOUT_SHORT = { SPENDE: "Spendenbescheinigung", UEBERWEISUNG: "Überweisung", BAR: "bar" } as const;

export default async function ExpensesPage() {
  const user = await requireUser();
  let claims;
  try {
    claims = await listClaims(user);
  } catch (e) {
    if (e instanceof ForbiddenError) redirect("/no-access");
    throw e;
  }
  const approver = can(user.role, "expense.approve");
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Auslagenerstattung"
          description={`Belege fotografieren oder als PDF hochladen, Erstattungsart wählen – nach Freigabe geht der Antrag als PDF an die Kreisgeschäftsstelle.${approver ? " Sie sehen alle Anträge." : ""}`}
        />
        {can(user.role, "expense.create") ? (
          <Button asChild>
            <Link href="/expenses/new">
              <Plus className="size-4" /> Neue Auslage
            </Link>
          </Button>
        ) : null}
      </div>
      {claims.length === 0 ? <p className="text-sm text-neutral-600">Noch keine Anträge.</p> : null}
      <ul className="flex flex-col gap-2">
        {claims.map((c) => (
          <li key={c.id}>
            <Link href={`/expenses/${c.id}`} className="flex items-center gap-3 rounded-lg border bg-white p-3 hover:border-cadenabbia">
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold text-rhoendorf">
                  {c.number} · {c.title}
                </div>
                <div className="text-xs text-neutral-600">
                  {approver ? `${c.claimantName} · ` : ""}
                  {formatDate(c.createdAt)} · {PAYOUT_SHORT[c.payout]} · {c.items.length} {c.items.length === 1 ? "Beleg" : "Belege"}
                </div>
              </div>
              <span className="font-semibold text-rhoendorf">{formatEuro(c.items.reduce((s, i) => s + i.amountCents, 0))}</span>
              <Badge variant={VARIANT[c.status]}>{STATUS_LABELS[c.status]}</Badge>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
