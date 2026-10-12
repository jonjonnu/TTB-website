import Link from "next/link";
import { db } from "@/lib/db";
import { serviceLabel } from "@/lib/entitlements";
import { baht, initials, maskEmail, maskPhone } from "@/lib/format";
import { benefitFor, employeeEntitlements, welfareRoundFor } from "@/lib/portal";
import { requireEmployee } from "@/lib/session";
import { Card, cx } from "@/components/ui";
import { logout } from "../../(auth)/actions";
import { AppHeader } from "../app-header";
import { AddressForm, PasswordForm } from "./account-forms";

export default async function AccountPage() {
  const emp = await requireEmployee();
  const view = await welfareRoundFor(emp);
  const benefit = view ? benefitFor(view.round, emp.department) : null;
  const [entitled, products, order] = await Promise.all([
    employeeEntitlements(emp, view?.round.opensAt),
    db.product.findMany({ orderBy: { sortOrder: "asc" } }),
    view ? db.order.findUnique({ where: { employeeId_roundId: { employeeId: emp.id, roundId: view.round.id } }, include: { items: true } }) : null,
  ]);
  const ordered = new Map(order?.items.map((i) => [i.productId, i.entitledQty]) ?? []);
  const rows = products.filter((p) => entitled.has(p.id));

  return (
    <>
      <AppHeader emp={emp} />
      <main className="space-y-3 px-4 py-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-sand font-medium text-navy">{initials(emp.firstName, emp.lastName)}</span>
            <div>
              <p className="font-medium">
                {emp.firstName} {emp.lastName}
              </p>
              <p className="text-xs text-muted">รหัสพนักงาน {emp.employeeCode}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <Info label="แผนก" value={emp.department} />
            <Info label="หน่วยงาน" value={emp.subDepartment ?? "-"} />
            <Info label="ตำแหน่ง" value={emp.position} />
            <Info label="อายุงาน" value={serviceLabel(emp.startDate)} />
            <div className="col-span-2">
              <dt className="text-xs text-muted">สถานที่ทำงาน (Work Location)</dt>
              <dd className="font-medium">{emp.workLocation ?? "-"}</dd>
              {emp.workAddress && <dd className="text-xs text-muted">{emp.workAddress}</dd>}
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted">ข้อมูลนี้มาจากฝ่ายบุคคล หากไม่ถูกต้องโปรดติดต่อ HR</p>
        </Card>

        {view && benefit?.mode === "CREDIT" && (
          <div className="rounded-xl bg-navy p-4 text-white">
            <div className="flex justify-between">
              <p className="font-medium">สิทธิ์ของฉัน</p>
              <span className="text-xs opacity-75">{view.round.name}</span>
            </div>
            <p className="text-sm opacity-85">รูปแบบ: เครดิตตามแผนก {emp.department}</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <Tile label="เครดิต" value={baht(benefit.credit)} />
              <Tile label="ใช้แล้ว" value={baht(order?.creditUsed ?? 0)} />
              <Tile label="ชำระเพิ่ม" value={baht(order?.total ?? 0)} />
            </div>
            <p className="mt-2 text-xs opacity-75">เครดิตไม่สะสมไปรอบถัดไป · พนักงาน Branch และ Wealth จะเห็นรายการเครื่องแบบตามสิทธิ์แทน</p>
          </div>
        )}
        {view && benefit?.mode === "FIXED" && (
          <Card className="p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-medium">สิทธิ์ของฉัน</p>
              <span className="text-xs text-muted">{view.round.name}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-cream text-xs text-muted">
                  <th className="px-2 py-1.5 text-left font-normal">เครื่องแบบ</th>
                  <th className="px-1 py-1.5 font-normal">สิทธิ์</th>
                  <th className="px-1 py-1.5 font-normal">สั่งแล้ว</th>
                  <th className="px-1 py-1.5 font-normal">คงเหลือ</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const total = entitled.get(p.id)!;
                  const used = ordered.get(p.id) ?? 0;
                  const left = total - used;
                  return (
                    <tr key={p.id} className="border-b border-line last:border-0">
                      <td className="px-2 py-2">{p.name}</td>
                      <td className="text-center">{total}</td>
                      <td className="text-center">{used}</td>
                      <td className="text-center">
                        <span className={cx("inline-block min-w-7 rounded px-1.5 text-xs font-medium", left ? "bg-accent-50 text-accent" : "bg-ok-50 text-ok")}>
                          {left}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-muted">จัดสรรตามตำแหน่งและอายุงาน · สิทธิ์ที่ไม่ได้ใช้ไม่สะสมไปรอบถัดไป</p>
          </Card>
        )}

        <Card className="divide-y divide-line text-sm">
          <Row label="เบอร์โทรและอีเมล" value={`${maskPhone(emp.phone)} · ${maskEmail(emp.email)}`} />
          <details className="px-3 py-2.5">
            <summary className="flex cursor-pointer justify-between">
              ที่อยู่บ้าน (สำหรับ Personal Order) <span className="text-muted">{emp.homeAddress ? "ตั้งค่าแล้ว" : "ยังไม่ได้ตั้ง"}</span>
            </summary>
            <AddressForm initial={emp.homeAddress ?? ""} />
          </details>
          <Link href="/notifications" className="flex justify-between px-3 py-2.5">
            การแจ้งเตือน
            <span className="text-muted">{[emp.notifySms && "SMS", emp.notifyEmail && "อีเมล", emp.notifyLine && "LINE"].filter(Boolean).join(", ") || "ปิด"}</span>
          </Link>
          <Link href="/size-guide" className="flex justify-between px-3 py-2.5">
            คู่มือเลือกไซส์ <span className="text-muted">›</span>
          </Link>
          <details className="px-3 py-2.5">
            <summary className="cursor-pointer">เปลี่ยนรหัสผ่าน</summary>
            <PasswordForm />
          </details>
          <form action={logout} className="px-3 py-2.5">
            <button className="font-medium text-bad">ออกจากระบบ</button>
          </form>
        </Card>
      </main>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/10 px-2 py-1.5">
      <p className="text-[11px] opacity-75">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 px-3 py-2.5">
      {label}
      <span className="text-right text-muted">{value}</span>
    </div>
  );
}
