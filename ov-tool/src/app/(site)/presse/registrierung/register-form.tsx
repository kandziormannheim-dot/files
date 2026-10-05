"use client";

import { useActionState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { registerPressAction } from "./actions";

export function RegisterForm({ privacyUrl }: { privacyUrl: string }) {
  const [state, formAction, pending] = useActionState(registerPressAction, null);
  if (state?.ok) {
    return (
      <Alert variant="success">
        <AlertDescription className="text-base">{state.message}</AlertDescription>
      </Alert>
    );
  }
  const err = (n: string) => state?.fieldErrors?.[n]?.[0];
  const field = (name: string, label: string, props: React.ComponentProps<typeof Input> = {}) => (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
      {err(name) ? <p className="text-sm text-red-700">{err(name)}</p> : null}
    </div>
  );
  return (
    <form action={formAction} className="grid gap-4 sm:grid-cols-2">
      {state && !state.ok && state.error ? (
        <Alert variant="destructive" className="sm:col-span-2">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {field("name", "Name *", { required: true, autoComplete: "name" })}
      {field("medium", "Medium / Redaktion *", { required: true, placeholder: "z. B. Mannheimer Morgen" })}
      {field("role", "Funktion", { placeholder: "z. B. Lokalredaktion" })}
      {field("email", "E-Mail *", { type: "email", required: true, autoComplete: "email" })}
      {field("phone", "Telefon (optional)", { type: "tel" })}
      {field("topics", "Themen / Ortsteile (optional)", { placeholder: "z. B. Seckenheim, Verkehr" })}
      <div className="hidden" aria-hidden>
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <label className="flex items-start gap-2 text-sm sm:col-span-2">
        <input type="checkbox" name="consent" required className="mt-1 size-4 accent-[#2d3c4b]" />
        <span>
          Ich willige ein, dass die CDU Seckenheim-Friedrichsfeld meine Angaben für den Versand von Pressemitteilungen speichert. Abmeldung jederzeit über den Link in
          jeder Mail.{" "}
          <a href={privacyUrl} className="underline" target="_blank" rel="noreferrer">
            Datenschutzerklärung
          </a>
        </span>
      </label>
      <Button type="submit" size="lg" disabled={pending} className="justify-self-start">
        {pending ? "Wird gesendet …" : "Registrieren"}
      </Button>
    </form>
  );
}
