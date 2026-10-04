"use client";

import { requestLoginLink } from "@/app/auth-actions";
import { ActionForm, Field, SubmitButton } from "@/components/form";
import { Input } from "@/components/ui/input";

export function LoginForm({ from }: { from?: string }) {
  return (
    <ActionForm action={requestLoginLink} className="flex flex-col gap-4">
      <input type="hidden" name="from" value={from ?? ""} />
      <Field label="E-Mail-Adresse" name="email">
        <Input id="email" name="email" type="email" autoComplete="email" required autoFocus />
      </Field>
      <SubmitButton pendingText="Wird gesendet …">Anmeldelink senden</SubmitButton>
    </ActionForm>
  );
}
