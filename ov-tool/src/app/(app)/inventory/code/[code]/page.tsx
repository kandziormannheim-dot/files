import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { parseInventoryCode } from "@/lib/inventory-code";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { findByCode } from "@/server/services/inventory";

// Ziel der QR-Codes auf den Etiketten und des Scanners.
export default async function CodePage({ params }: { params: Promise<{ code: string }> }) {
  const user = await requireUser();
  const raw = decodeURIComponent((await params).code);
  const item = await findByCode(user, raw);
  if (item) redirect(`/inventory/${item.id}`);
  const parsed = parseInventoryCode(raw);
  return (
    <>
      <PageHeader title="Code nicht gefunden" description={raw} />
      <p className="text-sm">
        {parsed
          ? "Zu diesem Code gibt es noch keinen Eintrag im Inventar."
          : "Das ist kein gültiger Inventarcode (Format OVMASF01234.20)."}
      </p>
      <div className="mt-4 flex gap-3 text-sm">
        {parsed && can(user.role, "inventory.edit") ? (
          <Link className="underline" href={`/inventory/new?number=${parsed.number}&year=${parsed.yearSuffix > new Date().getFullYear() % 100 ? 1900 + parsed.yearSuffix : 2000 + parsed.yearSuffix}`}>
            Mit dieser Nummer anlegen
          </Link>
        ) : null}
        <Link className="underline" href="/inventory">
          Zum Inventar
        </Link>
      </div>
    </>
  );
}
