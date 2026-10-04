import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-medium",
  {
    variants: {
      variant: {
        default: "border-transparent bg-akzent-hell text-akzent-dunkel",
        secondary: "border-transparent bg-neutral-100 text-neutral-700",
        destructive: "border-transparent bg-red-100 text-red-800",
        warning: "border-transparent bg-amber-100 text-amber-900",
        success: "border-transparent bg-green-100 text-green-800",
        outline: "border-neutral-300 text-neutral-700",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
