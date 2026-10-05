import { FileText, ImageIcon, Mail, MailX } from "lucide-react";
import {
  attachPreviousMinutesAction,
  deleteMeetingFileAction,
  toggleInvitationAction,
  uploadMeetingFilesAction,
} from "@/app/meeting-document-actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, SubmitButton } from "@/components/form";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";

type Doc = { id: string; fileName: string; mimeType: string; size: number; createdAt: Date; inInvitation: boolean; uploadedBy: { name: string } | null };

const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);

/**
 * Sitzungsunterlagen: letztes Protokoll, Vorlagen, Anträge. Mit „mit Einladung“ markierte Dateien gehen als Anhang
 * mit der Einladung raus und stehen Gästen auf der Rückmeldeseite zum Download bereit.
 */
export function MeetingDocuments({
  meetingId,
  docs,
  canManage,
  previousMinutes,
}: {
  meetingId: string;
  docs: Doc[];
  canManage: boolean;
  previousMinutes: { date: Date; status: string } | null;
}) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      {docs.length === 0 ? <p className="text-rhoendorf-60">Noch keine Unterlagen.</p> : null}
      <ul className="flex flex-col divide-y divide-rhoendorf-10">
        {docs.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
            <a href={`/api/attachments/${d.id}`} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-2 font-medium text-rhoendorf hover:underline">
              {d.mimeType.startsWith("image/") ? <ImageIcon className="size-4 shrink-0 text-cadenabbia" /> : <FileText className="size-4 shrink-0 text-cadenabbia" />}
              <span className="truncate">{d.fileName}</span>
            </a>
            <span className="flex flex-wrap items-center gap-2 text-xs text-rhoendorf-60">
              {d.inInvitation ? <Badge>mit Einladung</Badge> : <Badge variant="secondary">nur intern</Badge>}
              {kb(d.size)} · {formatDate(d.createdAt)}
              {d.uploadedBy ? ` · ${d.uploadedBy.name}` : ""}
              {canManage ? (
                <>
                  <ActionForm action={toggleInvitationAction.bind(null, meetingId, d.id, !d.inInvitation)} showErrorInline={false}>
                    <SubmitButton size="sm" variant="ghost" pendingText="…" title={d.inInvitation ? "Nicht mit der Einladung verschicken" : "Mit der Einladung verschicken"}>
                      {d.inInvitation ? <MailX className="size-4" /> : <Mail className="size-4" />}
                      <span className="sr-only sm:not-sr-only">{d.inInvitation ? "nicht versenden" : "mitsenden"}</span>
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={deleteMeetingFileAction.bind(null, meetingId, d.id)} showErrorInline={false}>
                    <ConfirmSubmit size="sm" variant="ghost" confirm={`„${d.fileName}“ löschen?`}>
                      Löschen
                    </ConfirmSubmit>
                  </ActionForm>
                </>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {canManage ? (
        <div className="flex flex-col gap-3 rounded-lg border border-dashed border-cadenabbia bg-cadenabbia-10 p-3">
          <ActionForm action={uploadMeetingFilesAction.bind(null, meetingId)} resetOnSuccess className="flex flex-col gap-2">
            <Input type="file" name="file" multiple required aria-label="Dateien" accept=".pdf,.docx,.xlsx,.pptx,.txt,image/*" />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="inInvitation" defaultChecked /> mit der Einladung verschicken
              </label>
              <SubmitButton size="sm" pendingText="Lädt hoch …">
                Hochladen
              </SubmitButton>
            </div>
            <p className="text-xs text-rhoendorf-60">PDF, Word, Excel, PowerPoint, Text oder Bilder, je bis 20 MB, bis zu 10 Dateien auf einmal.</p>
          </ActionForm>
          {previousMinutes ? (
            <ActionForm action={attachPreviousMinutesAction.bind(null, meetingId)} showErrorInline={false} className="flex flex-wrap items-center justify-between gap-2 border-t border-cadenabbia/40 pt-3">
              <span>
                Protokoll der Sitzung vom {formatDate(previousMinutes.date)}
                {previousMinutes.status === "ENTWURF" ? " (noch Entwurf)" : ""} aus dem Tool beifügen
              </span>
              <SubmitButton size="sm" variant="outline" pendingText="PDF wird erzeugt …">
                Letztes Protokoll beifügen
              </SubmitButton>
            </ActionForm>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
