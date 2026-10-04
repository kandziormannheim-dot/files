import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { can } from "@/server/auth/permissions";
import { requireUser } from "@/server/auth/session";
import { canEditLink, listLinks } from "@/server/services/links";
import { LinksBrowser } from "./links-browser";

export const metadata: Metadata = { title: "Links" };

export default async function LinksPage() {
  const user = await requireUser();
  const links = await listLinks(user);
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title="Links" description="CDUplus, Webseiten, Social Media, Verwaltung. Keine Passwörter speichern." />
        {can(user.role, "link.create") ? (
          <Button asChild>
            <Link href="/links/new">Link anlegen</Link>
          </Button>
        ) : null}
      </div>
      <LinksBrowser
        links={links.map((l) => ({ ...l, editable: canEditLink(user, l) }))}
        canSort={can(user.role, "link.manage")}
      />
    </>
  );
}
