"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { toast } from "sonner";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Label } from "./ui/label";

const FormStateContext = createContext<ActionState>(null);

type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

/**
 * Nach einem Update auf dem Server kennt dieser die Server Actions einer noch offenen, alten Seite nicht mehr
 * („Failed to find Server Action“). Statt eines stummen Fehlers lädt die Seite dann einmal neu.
 */
export function isStaleDeployError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /Server Action .*(was not found|not found on the server)|failed-to-find-server-action|Failed to find Server Action/i.test(msg);
}

function withStaleDeployGuard(action: FormAction): FormAction {
  return async (state, formData) => {
    try {
      return await action(state, formData);
    } catch (err) {
      if (isStaleDeployError(err)) {
        window.location.reload();
        return { ok: false, error: "Die Anwendung wurde aktualisiert – die Seite wird neu geladen. Bitte danach erneut absenden." };
      }
      console.error(err);
      return { ok: false, error: "Verbindung zum Server fehlgeschlagen. Bitte erneut versuchen." };
    }
  };
}

/** Formular für Server Actions mit Feldfehlern, Fehlermeldung und Erfolgshinweis. */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  showErrorInline = true,
  onSuccess,
  id,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showErrorInline?: boolean;
  onSuccess?: (state: NonNullable<ActionState>) => void;
  id?: string;
}) {
  const [state, formAction] = useActionState(withStaleDeployGuard(action), null);
  const formRef = useRef<HTMLFormElement>(null);
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });
  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      if (state.message) toast.success(state.message);
      if (resetOnSuccess) formRef.current?.reset();
      onSuccessRef.current?.(state);
    } else if (state.error && !showErrorInline) {
      toast.error(state.error);
    }
  }, [state, resetOnSuccess, showErrorInline]);

  return (
    <FormStateContext value={state}>
      <form ref={formRef} action={formAction} className={className} id={id}>
        {showErrorInline && state && !state.ok && state.error ? (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}
        {children}
      </form>
    </FormStateContext>
  );
}

export function FieldError({ name }: { name: string }) {
  const state = useContext(FormStateContext);
  const errors = state?.fieldErrors?.[name];
  if (!errors?.length) return null;
  return <p className="text-sm text-red-700">{errors[0]}</p>;
}

/** Beschriftetes Feld mit Hinweis und Fehlermeldung. */
export function Field({
  label,
  name,
  hint,
  children,
  className,
}: {
  label: ReactNode;
  name: string;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={name}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-neutral-600">{hint}</p> : null}
      <FieldError name={name} />
    </div>
  );
}

export function SubmitButton({
  children,
  pendingText = "Wird gespeichert …",
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
