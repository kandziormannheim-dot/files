"use client";

import type { ComponentProps } from "react";
import { SubmitButton } from "./form";

/** Absende-Knopf mit Rückfrage (z. B. Löschen). */
export function ConfirmSubmit({ confirm, ...props }: ComponentProps<typeof SubmitButton> & { confirm: string }) {
  return (
    <SubmitButton
      {...props}
      onClick={(e) => {
        if (!window.confirm(confirm)) e.preventDefault();
      }}
    />
  );
}
