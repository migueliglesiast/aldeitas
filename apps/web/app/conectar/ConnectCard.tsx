import type { ReactNode } from "react";

export function ConnectCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-3xl border border-line bg-white p-8 text-center shadow-card">
      <h1 className="font-display text-2xl font-bold text-ink">{title}</h1>
      <div className="mt-3 space-y-4 text-base text-muted">{children}</div>
    </div>
  );
}
