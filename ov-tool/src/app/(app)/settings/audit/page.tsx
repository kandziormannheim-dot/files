import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { requirePageCapability } from "@/server/auth/session";
import { listAuditLog } from "@/server/services/users";

export const metadata: Metadata = { title: "Audit-Log" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ typ?: string }> }) {
  const actor = await requirePageCapability("audit.read");
  const { typ } = await searchParams;
  const entries = await listAuditLog(actor, { entityType: typ });
  return (
    <>
      <PageHeader title="Audit-Log" description="Die letzten 200 Änderungen." />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Zeit</TableHead>
            <TableHead>Wer</TableHead>
            <TableHead>Aktion</TableHead>
            <TableHead className="hidden md:table-cell">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((e) => (
            <TableRow key={e.id}>
              <TableCell className="whitespace-nowrap">{formatDateTime(e.createdAt)}</TableCell>
              <TableCell>{e.user?.name ?? "System"}</TableCell>
              <TableCell>
                <code className="text-xs">{e.action}</code>
                <div className="text-xs text-neutral-500">
                  {e.entityType} {e.entityId?.slice(-6)}
                </div>
              </TableCell>
              <TableCell className="hidden max-w-md md:table-cell">
                {e.diff ? <code className="text-xs break-all">{JSON.stringify(e.diff).slice(0, 300)}</code> : null}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
