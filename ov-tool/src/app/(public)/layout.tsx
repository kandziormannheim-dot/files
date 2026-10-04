import type { ReactNode } from "react";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center bg-akzent-hell/40 px-4 py-10">
      <div className="mb-6 border-l-4 border-akzent pl-3 font-bold leading-tight">
        CDU Seckenheim-Friedrichsfeld
        <div className="text-sm font-normal text-neutral-600">OV-Management</div>
      </div>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
