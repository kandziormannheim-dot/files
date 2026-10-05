import type { Metadata } from "next";
import { Fragment } from "react";
import { ActionForm, SubmitButton } from "@/components/form";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { CAPABILITY_GROUPS, DEFAULT_ROLE_CAPABILITIES, EDITABLE_ROLES, ROLE_LABELS } from "@/server/auth/permissions";
import { rolePermissionMatrix } from "@/server/auth/role-permissions";
import { requirePageCapability } from "@/server/auth/session";
import { db } from "@/server/db";
import { resetPermissionsAction, savePermissionsAction } from "./actions";

export const metadata: Metadata = { title: "Rechte" };

export default async function PermissionsPage() {
  await requirePageCapability("settings.manage");
  const matrix = rolePermissionMatrix();
  const counts = await db.user.groupBy({ by: ["role"], _count: true, where: { active: true } });
  const count = (r: string) => counts.find((c) => c.role === r)?._count ?? 0;
  return (
    <>
      <PageHeader
        title="Rechtemanagement"
        description="Was jede Rolle im Tool darf. Die Rolle einer Person wird unter Einstellungen → Nutzer festgelegt. Admins haben immer alle Rechte."
      />
      <Card>
        <CardContent className="pt-6">
          <ActionForm action={savePermissionsAction} className="flex flex-col gap-4">
            <div className="-mx-2 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="px-2 py-2 font-semibold">Recht</th>
                    <th className="px-2 py-2 text-center font-semibold">
                      {ROLE_LABELS.ADMIN}
                      <span className="block text-xs font-normal text-neutral-600">{count("ADMIN")} Pers.</span>
                    </th>
                    {EDITABLE_ROLES.map((r) => (
                      <th key={r} className="px-2 py-2 text-center font-semibold">
                        {ROLE_LABELS[r]}
                        <span className="block text-xs font-normal text-neutral-600">{count(r)} Pers.</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CAPABILITY_GROUPS.map((g) => (
                    <Fragment key={g.title}>
                      <tr>
                        <th colSpan={2 + EDITABLE_ROLES.length} className="bg-akzent-hell/60 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-rhoendorf">
                          {g.title}
                        </th>
                      </tr>
                      {g.items.map(({ cap, label, hint }) => (
                        <tr key={cap} className="border-b last:border-0">
                          <td className="px-2 py-2">
                            {label}
                            {hint ? <span className="block text-xs text-neutral-600">{hint}</span> : null}
                          </td>
                          <td className="px-2 py-2 text-center">
                            <input type="checkbox" checked disabled aria-label={`${label} – Admin`} />
                          </td>
                          {EDITABLE_ROLES.map((r) => {
                            const isDefault = DEFAULT_ROLE_CAPABILITIES[r].includes(cap);
                            const checked = matrix[r].includes(cap);
                            return (
                              <td key={r} className="px-2 py-2 text-center">
                                <input
                                  type="checkbox"
                                  name={`cap:${r}:${cap}`}
                                  defaultChecked={checked}
                                  disabled={cap === "read"}
                                  aria-label={`${label} – ${ROLE_LABELS[r]}`}
                                  className="size-4 accent-[var(--color-akzent-dunkel)]"
                                />
                                {checked !== isDefault ? <span className="ml-1 text-[10px] text-amber-700" title="abweichend von der Werkseinstellung">●</span> : null}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-neutral-600">● = abweichend von der Werkseinstellung. Jede Änderung wird im Audit-Log festgehalten und gilt sofort.</p>
            <SubmitButton className="self-start">Rechte speichern</SubmitButton>
          </ActionForm>
          <ActionForm action={resetPermissionsAction} className="mt-3">
            <SubmitButton variant="ghost" size="sm" pendingText="…">
              Auf Werkseinstellung zurücksetzen
            </SubmitButton>
          </ActionForm>
        </CardContent>
      </Card>
    </>
  );
}
