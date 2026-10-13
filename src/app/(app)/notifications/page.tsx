import Link from "next/link";
import { db } from "@/lib/db";
import { thDateTime } from "@/lib/format";
import { requireEmployee } from "@/lib/session";
import { Card, TopBar, cx } from "@/components/ui";
import { markAllRead, savePreferences } from "../actions";

const icons: Record<string, { icon: string; cls: string }> = {
  EXTENSION: { icon: "⏰", cls: "bg-accent-50" },
  ORDER_EDITED: { icon: "✎", cls: "bg-cream" },
  PAYMENT: { icon: "฿", cls: "bg-ok-50" },
  ORDER_CONFIRMED: { icon: "✓", cls: "bg-ok-50" },
  STATUS: { icon: "🚚", cls: "bg-cream" },
  REMINDER: { icon: "🔔", cls: "bg-accent-50" },
  ACCOUNT: { icon: "👤", cls: "bg-cream" },
  ROUND_OPEN: { icon: "🔔", cls: "bg-cream" },
  EXCHANGE: { icon: "↺", cls: "bg-cream" },
};

export default async function NotificationsPage() {
  const emp = await requireEmployee();
  const items = await db.notification.findMany({ where: { employeeId: emp.id }, orderBy: { createdAt: "desc" }, take: 50 });

  return (
    <>
      <TopBar
        title="การแจ้งเตือน"
        back="/"
        right={
          <form action={markAllRead}>
            <button className="text-xs font-medium text-navy">อ่านทั้งหมด</button>
          </form>
        }
      />
      <main className="space-y-2 px-4 py-4">
        {items.length === 0 && <Card className="p-4 text-sm text-muted">ยังไม่มีการแจ้งเตือน</Card>}
        {items.map((n) => {
          const ic = icons[n.kind] ?? icons.ACCOUNT;
          const inner = (
            <div className={cx("flex gap-3 rounded-xl border bg-white p-3", n.readAt ? "border-line" : "border-navy/40 border-l-4")}>
              <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm", ic.cls)}>{ic.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium">{n.title}</p>
                  <span className="shrink-0 text-[11px] text-muted">{thDateTime(n.createdAt)}</span>
                </div>
                <p className="text-xs text-muted">{n.body}</p>
              </div>
            </div>
          );
          return n.href ? (
            <Link key={n.id} href={n.href} className="block">
              {inner}
            </Link>
          ) : (
            <div key={n.id}>{inner}</div>
          );
        })}

        <Card className="mt-4 p-3">
          <p className="mb-2 font-medium">รับการแจ้งเตือนทาง</p>
          <form action={savePreferences} className="divide-y divide-line text-sm">
            {(
              [
                ["notifyEmail", "อีเมล", emp.notifyEmail],
                ["notifySms", "SMS", emp.notifySms],
                ["notifyLine", "LINE (เร็วๆ นี้)", emp.notifyLine],
              ] as const
            ).map(([name, label, on]) => (
              <label key={name} className="flex items-center justify-between py-2.5">
                {label}
                <input type="checkbox" name={name} defaultChecked={on} className="h-4 w-4 accent-navy" />
              </label>
            ))}
            <div className="pt-2.5">
              <button className="text-sm font-medium text-navy">บันทึกการตั้งค่า</button>
            </div>
          </form>
        </Card>
      </main>
    </>
  );
}
