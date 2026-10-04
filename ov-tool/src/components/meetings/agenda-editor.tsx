"use client";

import type { AgendaItemStatus } from "@prisma/client";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  addAgendaItemAction,
  deleteAgendaItemAction,
  reorderAgendaAction,
  updateAgendaItemAction,
} from "@/app/(app)/meetings/actions";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { SortableList } from "@/components/sortable-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

export type EditorItem = {
  id: string;
  number: string;
  title: string;
  description: string;
  status: AgendaItemStatus;
  kind: string;
  children: EditorItem[];
};

const STATUS_LABEL: Record<AgendaItemStatus, string> = {
  OFFEN: "offen",
  BEHANDELT: "behandelt",
  ABGESETZT: "abgesetzt",
  VERTAGT: "vertagt",
};

export function AgendaStatusBadge({ status }: { status: AgendaItemStatus }) {
  if (status === "OFFEN") return null;
  return <Badge variant={status === "BEHANDELT" ? "success" : "warning"}>{STATUS_LABEL[status]}</Badge>;
}

export function AgendaEditor({
  meetingId,
  items,
  editable,
  canDelete,
}: {
  meetingId: string;
  items: EditorItem[];
  editable: boolean;
  canDelete: boolean;
}) {
  const [editing, setEditing] = useState<EditorItem | null>(null);

  async function reorder(parentId: string | null, ids: string[]) {
    const res = await reorderAgendaAction(meetingId, parentId, ids);
    if (res && !res.ok) toast.error(res.error);
  }
  async function remove(item: EditorItem) {
    if (!window.confirm(`TOP „${item.title}“ löschen?`)) return;
    const res = await deleteAgendaItemAction(meetingId, item.id);
    if (res?.ok) toast.success(res.message);
    else if (res) toast.error(res.error);
  }

  const row = (item: EditorItem) => (
    <div className="flex items-start gap-2 rounded-md border border-neutral-200 bg-white px-2 py-2">
      <span className="w-10 shrink-0 font-semibold tabular-nums">{item.number}</span>
      <div className="min-w-0 flex-1">
        <div className={item.status === "ABGESETZT" ? "line-through" : ""}>{item.title}</div>
        {item.description ? <div className="text-xs whitespace-pre-wrap text-neutral-600">{item.description}</div> : null}
      </div>
      <AgendaStatusBadge status={item.status} />
      {editable ? (
        <>
          <Button variant="ghost" size="icon" aria-label="Bearbeiten" onClick={() => setEditing(item)}>
            <Pencil />
          </Button>
          {canDelete ? (
            <Button variant="ghost" size="icon" aria-label="Löschen" onClick={() => remove(item)}>
              <Trash2 />
            </Button>
          ) : null}
        </>
      ) : null}
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <SortableList
        items={items}
        disabled={!editable}
        onReorder={(ids) => reorder(null, ids)}
        className="flex flex-col gap-1.5"
        renderItem={(item) => (
          <div className="flex flex-col gap-1.5">
            {row(item)}
            {item.children.length ? (
              <SortableList
                items={item.children}
                disabled={!editable}
                onReorder={(ids) => reorder(item.id, ids)}
                className="ml-6 flex flex-col gap-1.5"
                renderItem={row}
              />
            ) : null}
          </div>
        )}
      />
      {editable ? (
        <ActionForm action={addAgendaItemAction.bind(null, meetingId)} resetOnSuccess className="grid gap-2 rounded-md border border-dashed p-3 sm:grid-cols-[1fr_12rem_auto]">
          <Input name="title" placeholder="Neuer TOP …" aria-label="Titel des neuen TOPs" required />
          <NativeSelect name="parentId" aria-label="Ebene" defaultValue="">
            <option value="">als eigener TOP</option>
            {items.map((i) => (
              <option key={i.id} value={i.id}>
                Unterpunkt zu TOP {i.number}
              </option>
            ))}
          </NativeSelect>
          <SubmitButton variant="secondary" pendingText="…">
            Hinzufügen
          </SubmitButton>
        </ActionForm>
      ) : null}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>TOP {editing?.number} bearbeiten</DialogTitle>
          </DialogHeader>
          {editing ? (
            <ActionForm
              key={editing.id}
              action={updateAgendaItemAction.bind(null, meetingId, editing.id)}
              onSuccess={() => setEditing(null)}
              className="flex flex-col gap-3"
            >
              <Field label="Titel" name="title">
                <Input id="title" name="title" defaultValue={editing.title} required />
              </Field>
              <Field label="Beschreibung" name="description">
                <Textarea id="description" name="description" defaultValue={editing.description} rows={3} />
              </Field>
              <Field label="Status" name="status" hint="Abgesetzte und vertagte TOPs werden bei der nächsten Sitzung wieder vorgeschlagen.">
                <NativeSelect id="status" name="status" defaultValue={editing.status}>
                  <option value="OFFEN">offen</option>
                  <option value="BEHANDELT">behandelt</option>
                  <option value="ABGESETZT">abgesetzt</option>
                  <option value="VERTAGT">vertagt</option>
                </NativeSelect>
              </Field>
              <SubmitButton className="self-start">Speichern</SubmitButton>
            </ActionForm>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
