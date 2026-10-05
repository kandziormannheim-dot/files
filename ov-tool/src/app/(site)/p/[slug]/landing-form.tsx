"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ActionState } from "@/lib/action-state";

type Props = {
  action: (s: ActionState, f: FormData) => Promise<ActionState>;
  title: string;
  askPhone: boolean;
  askMessage: boolean;
  messageLabel: string;
  consentText: string;
  newsletterOption: boolean;
  privacyUrl: string;
};

export function LandingForm(p: Props) {
  const [state, formAction, pending] = useActionState(p.action, null);
  if (state?.ok) {
    return (
      <Alert variant="success">
        <AlertDescription className="text-base">{state.message}</AlertDescription>
      </Alert>
    );
  }
  const err = (n: string) => state?.fieldErrors?.[n]?.[0];
  return (
    <form action={formAction} className="flex flex-col gap-4">
      <h2 className="text-xl font-extrabold text-rhoendorf">{p.title || "Jetzt eintragen"}</h2>
      {state && !state.ok && state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" name="name" required autoComplete="name" />
        {err("name") ? <p className="text-sm text-red-700">{err("name")}</p> : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-Mail *</Label>
        <Input id="email" name="email" type="email" required autoComplete="email" />
        {err("email") ? <p className="text-sm text-red-700">{err("email")}</p> : null}
      </div>
      {p.askPhone ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="phone">Telefon (optional)</Label>
          <Input id="phone" name="phone" type="tel" autoComplete="tel" />
        </div>
      ) : null}
      {p.askMessage ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="message">{p.messageLabel || "Ihre Nachricht (optional)"}</Label>
          <Textarea id="message" name="message" rows={4} maxLength={3000} />
        </div>
      ) : null}
      <div className="hidden" aria-hidden>
        <label>
          Webseite <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="consent" required className="mt-1 size-4 accent-[#2d3c4b]" />
        <span>
          {p.consentText}{" "}
          <a href={p.privacyUrl} className="underline" target="_blank" rel="noreferrer">
            Datenschutzerklärung
          </a>
        </span>
      </label>
      {err("consent") ? <p className="text-sm text-red-700">{err("consent")}</p> : null}
      {p.newsletterOption ? (
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="newsletter" className="mt-1 size-4 accent-[#2d3c4b]" />
          <span>Ja, ich möchte den Newsletter der CDU Seckenheim-Friedrichsfeld erhalten (Bestätigung per E-Mail, jederzeit abbestellbar).</span>
        </label>
      ) : null}
      <Button type="submit" size="lg" disabled={pending} className="self-start">
        {pending ? "Wird gesendet …" : "Absenden"}
      </Button>
    </form>
  );
}
