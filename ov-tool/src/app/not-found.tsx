import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function NotFound() {
  return (
    <>
      <PageHeader title="Seite nicht gefunden" />
      <Link href="/" className="text-akzent-dunkel underline">
        Zur Übersicht
      </Link>
    </>
  );
}
