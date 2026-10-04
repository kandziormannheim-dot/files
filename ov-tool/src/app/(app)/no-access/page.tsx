import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function NoAccessPage() {
  return (
    <>
      <PageHeader title="Kein Zugriff" description="Für diese Seite fehlt Ihnen die Berechtigung." />
      <Link href="/" className="text-akzent-dunkel underline">
        Zur Übersicht
      </Link>
    </>
  );
}
