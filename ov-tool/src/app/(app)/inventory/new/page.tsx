import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { requirePageCapability } from "@/server/auth/session";
import { inventoryFacets, nextFreeNumber } from "@/server/services/inventory";
import { createItemAction } from "../actions";
import { ItemForm } from "../item-form";

export const metadata: Metadata = { title: "Gegenstand anlegen" };

export default async function NewItemPage({ searchParams }: { searchParams: Promise<{ number?: string; year?: string }> }) {
  const user = await requirePageCapability("inventory.edit");
  const sp = await searchParams;
  const [facets, next] = await Promise.all([inventoryFacets(user), nextFreeNumber()]);
  const num = Number(sp.number);
  const yr = Number(sp.year);
  return (
    <>
      <PageHeader title="Gegenstand anlegen" description="Code (OVMASF + Nummer + Anschaffungsjahr) wird automatisch vergeben." />
      <Card className="max-w-2xl">
        <CardContent className="pt-6">
          <ItemForm
            action={createItemAction}
            nextNumber={next}
            locations={facets.locations}
            categories={facets.categories}
            defaults={{ number: Number.isInteger(num) && num > 0 ? num : undefined, year: Number.isInteger(yr) && yr > 1900 ? yr : undefined }}
          />
        </CardContent>
      </Card>
    </>
  );
}
