import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/dates";
import { requirePageCapability } from "@/server/auth/session";
import { listTemplates } from "@/server/services/templates";

export const metadata: Metadata = { title: "Vorlagen" };

const KIND: Record<string, string> = { mail: "E-Mail", dokument: "PDF-Dokument", json: "Tagesordnung", prompt: "KI-Prompt" };

export default async function TemplatesPage() {
  const user = await requirePageCapability("templates.manage");
  const templates = await listTemplates(user);
  return (
    <>
      <PageHeader
        title="Vorlagen"
        description="Werden automatisch angewendet. Jede Änderung ist eine neue Version; versendete Dokumente merken sich ihre Version."
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Vorlage</TableHead>
            <TableHead className="hidden sm:table-cell">Art</TableHead>
            <TableHead className="hidden md:table-cell">Verwendung</TableHead>
            <TableHead>Version</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {templates.map(({ def, active }) => (
            <TableRow key={def.key}>
              <TableCell>
                <Link href={`/settings/templates/${def.key}`} className="font-medium text-akzent-dunkel hover:underline">
                  {def.name}
                </Link>
                <div className="text-xs text-neutral-500">{def.key}</div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">{KIND[def.kind]}</TableCell>
              <TableCell className="hidden md:table-cell">{def.usage}</TableCell>
              <TableCell>
                {active ? (
                  <>
                    v{active.version}
                    <div className="text-xs text-neutral-500">
                      {formatDateTime(active.createdAt)}
                      {active.createdBy ? ` · ${active.createdBy.name}` : ""}
                    </div>
                  </>
                ) : (
                  <span className="text-neutral-500">Datei (nicht geseedet)</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
