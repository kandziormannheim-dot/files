import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const alertVariants = cva("relative w-full rounded-lg border px-4 py-3 text-sm", {
  variants: {
    variant: {
      default: "border-cadenabbia bg-cadenabbia-10 text-rhoendorf",
      destructive: "border-union-rot/40 bg-union-rot/5 text-union-rot",
      warning: "border-union-gold bg-union-gold/10 text-[#5c3b00]",
      success: "border-green-300 bg-green-50 text-green-900",
    },
  },
  defaultVariants: { variant: "default" },
});

function Alert({ className, variant, ...props }: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
function AlertTitle({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("font-semibold", className)} {...props} />;
}
function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("mt-1", className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle };
