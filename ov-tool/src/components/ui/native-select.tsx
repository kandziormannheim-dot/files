import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import { fieldClass } from "./input";

// Natives <select>: funktioniert in Server-Formularen ohne JavaScript und ist auf dem Handy am bequemsten.
function NativeSelect({ className, ...props }: ComponentProps<"select">) {
  return <select data-slot="native-select" className={cn(fieldClass, "h-10 pr-8", className)} {...props} />;
}

export { NativeSelect };
