"use client";

import { FileText, ImageIcon, Paperclip, Trash2 } from "lucide-react";
import { deleteTopFileAction, saveTopNoteAction, uploadTopFilesAction } from "@/app/meeting-document-actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, SubmitButton } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export type TopFile = { id: string; fileName: string; mimeType: string; size: number; inInvitation: boolean };

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

/**
 * Notiz und Anhänge zu einem TOP. Die Notiz steht im Protokoll unter dem TOP, Anhänge werden dort als „Anlage n“
 * genannt und ans Protokoll-PDF angehängt (PDF und Bilder).
 */
export function TopExtras({
  meetingId,
  agendaItemId,
  label,
  note,
  files,
  canEdit,
  compact = false,
}: {
  meetingId: string;
  agendaItemId: string;
  label: string;
  note: string;
  files: TopFile[];
  canEdit: boolean;
  compact?: boolean;
}) {
  if (!canEdit && !note && files.length === 0) return null;
  const body = (
    <div className="flex flex-col gap-2">
      {canEdit ? (
        <ActionForm action={saveTopNoteAction.bind(null, meetingId, agendaItemId)} showErrorInline={false} className="flex flex-col gap-1">
          <Textarea name="note" rows={Math.max(2, note.split("\n").length)} defaultValue={note} maxLength={5000} placeholder="Notiz zum TOP – erscheint im Protokoll" aria-label={`Notiz ${label}`} />
          <SubmitButton size="sm" variant="outline" className="self-start" pendingText="…">
            Notiz speichern
          </SubmitButton>
        </ActionForm>
      ) : note ? (
        <p className="whitespace-pre-line text-sm">
          <span className="font-semibold">Notiz:</span> {note}
        </p>
      ) : null}
      {files.length ? (
        <ul className="flex flex-col gap-1 text-sm">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2">
              <a href={`/api/attachments/${f.id}`} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-2 text-rhoendorf hover:underline">
                {f.mimeType.startsWith("image/") ? <ImageIcon className="size-4 shrink-0 text-cadenabbia" /> : <FileText className="size-4 shrink-0 text-cadenabbia" />}
                <span className="truncate">{f.fileName}</span>
              </a>
              <span className="text-xs text-rhoendorf-60">{kb(f.size)}</span>
              <Badge variant="warning">Anlage Protokoll</Badge>
              {f.inInvitation ? <Badge>mit Einladung</Badge> : null}
              {canEdit ? (
                <ActionForm action={deleteTopFileAction.bind(null, meetingId, f.id)} showErrorInline={false}>
                  <ConfirmSubmit size="sm" variant="ghost" confirm={`„${f.fileName}“ entfernen?`} pendingText="…" aria-label="Anlage entfernen">
                    <Trash2 className="size-4" />
                  </ConfirmSubmit>
                </ActionForm>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {canEdit ? (
        <ActionForm action={uploadTopFilesAction.bind(null, meetingId, agendaItemId)} resetOnSuccess showErrorInline={false} className="flex flex-wrap items-center gap-2">
          <Input type="file" name="file" multiple required className="min-w-0 flex-1 text-xs" aria-label={`Anhang ${label}`} accept=".pdf,.docx,.xlsx,.pptx,.txt,image/*" />
          <label className="flex items-center gap-1 text-xs">
            <input type="checkbox" name="inInvitation" /> auch mit Einladung
          </label>
          <SubmitButton size="sm" variant="outline" pendingText="Lädt hoch …">
            <Paperclip className="size-4" /> Anhang
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
  if (compact) return body;
  const summary = [note ? "Notiz" : "", files.length ? `${files.length} ${files.length === 1 ? "Anlage" : "Anlagen"}` : ""].filter(Boolean).join(" · ");
  return (
    <details className="group rounded-md border border-rhoendorf-10 bg-white p-3" open={!!note || files.length > 0}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-rhoendorf">
        <span className="min-w-0 truncate">{label}</span>
        <span className="shrink-0 text-xs font-normal text-rhoendorf-60">{summary || (canEdit ? "Notiz/Anhang hinzufügen +" : "")}</span>
      </summary>
      <div className="mt-2">{body}</div>
    </details>
  );
}
