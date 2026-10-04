"use client";

import { useState, useTransition } from "react";
import { previewTemplateAction, saveTemplateAction } from "@/app/(app)/settings/actions";
import { ActionForm, SubmitButton } from "@/components/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { TemplatePreview } from "@/server/services/templates";

export function TemplateEditor({ templateKey, initialBody }: { templateKey: string; initialBody: string }) {
  const [body, setBody] = useState(initialBody);
  const [preview, setPreview] = useState<TemplatePreview | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <ActionForm action={saveTemplateAction.bind(null, templateKey)} className="flex flex-col gap-3">
        <Textarea
          name="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={28}
          spellCheck={false}
          className="font-mono text-xs leading-relaxed"
          aria-label="Vorlagentext"
        />
        <div className="flex flex-wrap gap-2">
          <SubmitButton>Als neue Version speichern</SubmitButton>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => startTransition(async () => setPreview(await previewTemplateAction(templateKey, body)))}
          >
            {pending ? "…" : "Vorschau"}
          </Button>
        </div>
      </ActionForm>
      <div className="min-w-0">
        {!preview ? (
          <p className="text-sm text-neutral-600">Die Vorschau nutzt erfundene Beispieldaten.</p>
        ) : preview.kind === "error" ? (
          <Alert variant="destructive">
            <AlertDescription>
              {preview.errors.map((e) => (
                <div key={e}>{e}</div>
              ))}
            </AlertDescription>
          </Alert>
        ) : preview.kind === "mail" ? (
          <div className="rounded-md border bg-white p-3 text-sm">
            <div className="mb-2 border-b pb-2 font-semibold">{preview.subject}</div>
            <pre className="font-sans whitespace-pre-wrap">{preview.text}</pre>
          </div>
        ) : preview.kind === "html" ? (
          <iframe title="Vorschau" srcDoc={preview.html} className="h-[80dvh] w-full rounded-md border bg-white" />
        ) : preview.kind === "list" ? (
          <pre className="rounded-md border bg-white p-3 text-sm">{preview.items.join("\n")}</pre>
        ) : (
          <pre className="rounded-md border bg-white p-3 text-xs whitespace-pre-wrap">{preview.text}</pre>
        )}
      </div>
    </div>
  );
}
