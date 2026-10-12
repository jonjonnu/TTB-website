import { requireEmployee } from "@/lib/session";
import { BottomNav } from "./bottom-nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireEmployee();
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-canvas shadow-[0_0_0_1px_#e5e7eb]">
      <div className="flex-1 pb-16">{children}</div>
      <BottomNav />
    </div>
  );
}
