// Minimal layout for admin auth pages (login).
// Intentionally has NO admin guard so /admin/login doesn't redirect-loop.
import type { ReactNode } from "react";

export default function AdminAuthLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
