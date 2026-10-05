import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
  {
    variants: {
      variant: {
        default: "border-transparent bg-cadenabbia-25 text-rhoendorf",
        secondary: "border-transparent bg-rhoendorf-10 text-rhoendorf",
        destructive: "border-transparent bg-union-rot/10 text-union-rot",
        warning: "border-transparent bg-union-gold/20 text-[#7a4f00]",
        success: "border-transparent bg-green-100 text-green-800",
        outline: "border-rhoendorf-25 text-rhoendorf",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Badge({ className, variant, ...props }: ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
