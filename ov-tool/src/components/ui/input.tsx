import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export const fieldClass =
  "w-full min-w-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-base md:text-sm outline-none focus-visible:border-akzent focus-visible:ring-2 focus-visible:ring-akzent/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-red-600";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldClass, "h-10", className)} {...props} />;
}

export { Input };
