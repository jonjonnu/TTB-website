import Link from "next/link";
import { redirect } from "next/navigation";
import { currentEmployee } from "@/lib/session";
import { welfareRoundFor } from "@/lib/portal";
import { thDateTime } from "@/lib/format";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentEmployee()) redirect("/");
  const view = await welfareRoundFor();
  return (
    <div className="flex min-h-dvh flex-col">
      <div className="bg-navy px-5 pb-16 pt-6 text-white">
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-white px-1.5 py-0.5 text-xs font-medium text-navy">TTB</span>
          <span className="text-xs opacity-80">× Songsmai</span>
        </div>
        <h1 className="mt-5 text-2xl font-medium">ระบบสั่งเครื่องแบบพนักงาน</h1>
        <p className="mt-1 text-sm opacity-80">เลือกไซส์และสั่งเครื่องแบบตามสิทธิ์ของคุณได้ในที่เดียว</p>
      </div>
      <div className="-mt-10 px-4">
        <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
          <LoginForm />
          <p className="mt-4 text-center text-sm text-muted">
            ยังไม่มีบัญชี?{" "}
            <Link href="/register" className="font-medium text-navy">
              ลงทะเบียนด้วยรหัสพนักงาน
            </Link>
          </p>
        </div>
        {view && view.phase !== "CLOSED" && (
          <div className="mt-4 flex gap-2 rounded-lg border border-accent/30 bg-accent-50 px-3 py-2.5 text-sm text-accent">
            <span aria-hidden>⏰</span>
            <span>
              <b>{view.phase === "OPEN" ? `${view.round.name} เปิดอยู่` : `${view.round.name} เปิดเร็วๆ นี้`}</b>{" "}
              {view.phase === "OPEN" ? `ปิดรับ ${thDateTime(view.closeAt)} น.` : `เปิดรับ ${thDateTime(view.round.opensAt)} น.`}
            </span>
          </div>
        )}
      </div>
      <div className="mt-auto px-4 py-6 text-center text-xs text-muted">
        ติดต่อสอบถามเรื่องเครื่องแบบ: Songsmai Call Center 02-433-9881 · LINE @songsmai
        <br />
        info@songsmaigroup.com
        <div className="mt-2">
          <Link href="/admin/login" className="underline">
            สำหรับผู้ดูแลระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
