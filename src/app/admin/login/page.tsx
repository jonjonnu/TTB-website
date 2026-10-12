import { redirect } from "next/navigation";
import { currentAdmin } from "@/lib/session";
import { AdminLoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await currentAdmin()) redirect("/admin");
  return (
    <div className="grid min-h-dvh place-items-center bg-sidebar px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6">
        <div className="mb-4 flex items-center gap-2">
          <span className="rounded-md bg-navy px-1.5 py-0.5 text-xs font-bold text-white">TTB</span>
          <span className="font-semibold">Uniform Admin</span>
        </div>
        <AdminLoginForm />
      </div>
    </div>
  );
}
