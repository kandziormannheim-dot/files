import type { Metadata } from "next";
import Link from "next/link";
import { Mail, Phone } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { VOTING_RIGHT_LABELS } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { listBoard } from "@/server/services/users";

export const metadata: Metadata = { title: "Vorstand" };

export default async function BoardPage() {
  const user = await requireUser();
  const board = await listBoard(user);
  const voting = board.filter((b) => b.votingRight === "STIMMBERECHTIGT").length;
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Vorstand"
          description={`${board.length} Personen, davon ${voting} stimmberechtigt. Mandatsträger sind beratend kooptiert.`}
        />
        {user.role === "ADMIN" ? (
          <Link href="/settings/users" className="text-sm underline">
            Personen verwalten
          </Link>
        ) : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {board.map((b) => (
          <Card key={b.id} className={b.id === user.id ? "ring-2 ring-akzent/40" : undefined}>
            <CardContent className="flex flex-col gap-2 pt-4 text-sm">
              <div>
                <p className="text-base font-semibold">{b.name}</p>
                <p className="text-neutral-600">{b.functionTitle || "–"}</p>
              </div>
              <div>
                <Badge variant={b.votingRight === "STIMMBERECHTIGT" ? "default" : "secondary"}>{VOTING_RIGHT_LABELS[b.votingRight]}</Badge>
              </div>
              <a href={`mailto:${b.email}`} className="flex items-center gap-2 break-all underline-offset-2 hover:underline">
                <Mail className="size-4 shrink-0" aria-hidden /> {b.email}
              </a>
              {b.phone ? (
                <a href={`tel:${b.phone.replace(/[^+0-9]/g, "")}`} className="flex items-center gap-2 underline-offset-2 hover:underline">
                  <Phone className="size-4 shrink-0" aria-hidden /> {b.phone}
                </a>
              ) : null}
              {b.id === user.id ? (
                <Link href="/profile" className="text-xs text-neutral-600 underline">
                  Eigene Angaben bearbeiten
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ))}
      </div>
      {board.length > 0 ? (
        <p className="mt-4 text-sm">
          <a className="underline" href={`mailto:?bcc=${board.map((b) => b.email).join(",")}`}>
            E-Mail an alle (BCC)
          </a>
        </p>
      ) : null}
    </>
  );
}
