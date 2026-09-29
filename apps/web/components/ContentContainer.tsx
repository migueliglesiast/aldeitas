import type { ReactNode } from "react";

export default function ContentContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">{children}</div>;
}
