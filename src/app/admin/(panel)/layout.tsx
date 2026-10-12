import { requireAdmin } from "@/lib/session";
import { adminLogout } from "../actions";
import { AdminNav } from "./nav";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="min-h-dvh md:flex">
      <aside className="flex shrink-0 flex-col bg-sidebar text-white md:sticky md:top-0 md:h-dvh md:w-60">
        <div className="flex items-center gap-2 px-4 py-4">
          <span className="rounded-md bg-white px-1.5 py-0.5 text-xs font-bold text-navy">TTB</span>
          <span className="font-semibold">Uniform Admin</span>
        </div>
        <AdminNav />
        <div className="mt-auto hidden border-t border-white/10 px-4 py-3 text-xs md:block">
          <p className="font-semibold">{admin.name}</p>
          <p className="opacity-60">{admin.role === "OWNER" ? "Owner" : "Admin"}</p>
          <form action={adminLogout} className="mt-2">
            <button className="opacity-80 hover:opacity-100">ออกจากระบบ</button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 bg-canvas p-4 md:p-6">{children}</main>
    </div>
  );
}
