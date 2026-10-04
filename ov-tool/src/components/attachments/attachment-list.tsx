import { FileText, ImageIcon } from "lucide-react";
import { addAttachmentAction, deleteAttachmentAction } from "@/app/attachment-actions";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ActionForm, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";
import { formatDate } from "@/lib/dates";
import type { OwnerType } from "@/server/services/attachments";

type Item = { id: string; fileName: string; mimeType: string; size: number; createdAt: Date; uploadedById: string | null; uploadedBy: { name: string } | null };

export function AttachmentList({
  ownerType,
  ownerId,
  path,
  items,
  canUpload,
  canDelete,
}: {
  ownerType: OwnerType;
  ownerId: string;
  path: string;
  items: Item[];
  canUpload: boolean;
  canDelete: (item: Item) => boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {items.length === 0 ? <p className="text-sm text-neutral-600">Keine Anhänge.</p> : null}
      <ul className="flex flex-col gap-2">
        {items.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <a href={`/api/attachments/${a.id}`} target="_blank" rel="noopener" className="flex min-w-0 items-center gap-2 text-akzent-dunkel hover:underline">
              {a.mimeType.startsWith("image/") ? <ImageIcon className="size-4 shrink-0" /> : <FileText className="size-4 shrink-0" />}
              <span className="truncate">{a.fileName}</span>
            </a>
            <span className="flex items-center gap-2 text-xs text-neutral-500">
              {Math.ceil(a.size / 1024)} KB · {formatDate(a.createdAt)}
              {a.uploadedBy ? ` · ${a.uploadedBy.name}` : ""}
              {canDelete(a) ? (
                <ActionForm action={deleteAttachmentAction.bind(null, a.id, path)} showErrorInline={false}>
                  <ConfirmSubmit size="sm" variant="ghost" confirm={`„${a.fileName}“ löschen?`}>
                    Löschen
                  </ConfirmSubmit>
                </ActionForm>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {canUpload ? (
        <ActionForm action={addAttachmentAction.bind(null, ownerType, ownerId, path)} resetOnSuccess className="flex flex-wrap items-center gap-2">
          <Input type="file" name="file" required className="max-w-xs" aria-label="Datei" />
          <SubmitButton variant="outline" size="sm" pendingText="Lädt …">
            Hochladen
          </SubmitButton>
        </ActionForm>
      ) : null}
    </div>
  );
}
