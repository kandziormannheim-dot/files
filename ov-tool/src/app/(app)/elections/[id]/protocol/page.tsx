import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatuteRef } from "@/components/statute-ref";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { NotFoundError } from "@/server/errors";
import { electionProtocol, getElection } from "@/server/services/elections";
import { getSettings } from "@/server/services/settings";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Niederschrift Wahlteil" };

export default async function ProtocolPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  let election;
  try {
    election = await getElection(user, id);
  } catch (e) {
    if (e instanceof NotFoundError) notFound();
    throw e;
  }
  const settings = await getSettings();
  const text = electionProtocol(election, `CDU ${settings.ov.name}`);
  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 self-start">
        <Link href={`/elections/${id}`}>
          <ArrowLeft className="size-4" /> {election.title}
        </Link>
      </Button>
      <PageHeader title="Niederschrift – Wahlteil" description="Mit allen Pflichtangaben: Bewerber, gültige Stimmen, Stimmen je Bewerber, geheime Wahl." />
      <p className="mb-4 text-sm text-neutral-600">
        Pflichtinhalt nach <StatuteRef cite="LV-Satzung § 51 Abs. 2">LV-Satzung § 51 Abs. 2</StatuteRef>. Text in das Protokoll der Mitgliederversammlung übernehmen; die
        Niederschrift ist zu unterzeichnen und der Kreisgeschäftsstelle zu übersenden (<StatuteRef cite="LV-Satzung § 51 Abs. 3">§ 51 Abs. 3</StatuteRef>).
      </p>
      <Card>
        <CardContent className="pt-6">
          <pre className="whitespace-pre-wrap break-words font-sans text-[15px] leading-relaxed text-rhoendorf">{text}</pre>
          <div className="mt-4">
            <CopyButton text={text} />
          </div>
        </CardContent>
      </Card>
    </>
  );
}
