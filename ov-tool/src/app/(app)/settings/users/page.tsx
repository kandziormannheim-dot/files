import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABELS, VOTING_RIGHT_LABELS } from "@/server/auth/permissions";
import { requirePageCapability } from "@/server/auth/session";
import { listAllUsers } from "@/server/services/users";

export const metadata: Metadata = { title: "Nutzer" };

export default async function UsersPage() {
  const actor = await requirePageCapability("users.manage");
  const users = await listAllUsers(actor);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Nutzer" description="Vorstand und Gäste. Keine Mitgliederdaten – nur wer mit dem Tool arbeitet." />
        <Button asChild>
          <Link href="/settings/users/new">Nutzer anlegen</Link>
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Funktion</TableHead>
            <TableHead>Rolle</TableHead>
            <TableHead className="hidden md:table-cell">Stimmrecht</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id} className={u.active ? "" : "text-neutral-500"}>
              <TableCell>
                <Link href={`/settings/users/${u.id}`} className="font-medium text-akzent-dunkel hover:underline">
                  {u.name}
                </Link>
                <div className="text-xs text-neutral-500">{u.email}</div>
              </TableCell>
              <TableCell className="hidden sm:table-cell">{u.functionTitle}</TableCell>
              <TableCell>{ROLE_LABELS[u.role]}</TableCell>
              <TableCell className="hidden md:table-cell">{VOTING_RIGHT_LABELS[u.votingRight]}</TableCell>
              <TableCell>
                {!u.active ? (
                  <Badge variant="secondary">inaktiv</Badge>
                ) : !u.loginEnabled ? (
                  <Badge variant="outline">ohne Login</Badge>
                ) : (
                  <Badge variant="success">aktiv</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </>
  );
}
