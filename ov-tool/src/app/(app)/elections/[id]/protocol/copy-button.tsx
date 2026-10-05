"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyButton({ text }: { text: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => navigator.clipboard.writeText(text).then(() => toast.success("Kopiert"), () => toast.error("Kopieren nicht möglich"))}
    >
      <Copy className="size-4" /> Text kopieren
    </Button>
  );
}
