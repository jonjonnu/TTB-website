import Link from "next/link";
import { db } from "@/lib/db";
import { initials, maskEmail, maskPhone } from "@/lib/format";
import { currentRound, employeeEntitlements } from "@/lib/portal";
import { roundLabel } from "@/lib/rounds";
import { requireEmployee } from "@/lib/session";
import { Card, cx } from "@/components/ui";
import { logout } from "../../(auth)/actions";
import { AppHeader } from "../app-header";
import { AddressForm, PasswordForm } from "./account-forms";

export default async function AccountPage() {
  const emp = await requireEmployee();
  const view = await currentRound(emp.department);
  const [entitled, products, order] = await Promise.all([
    employeeEntitlements(emp),
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
            <span className="grid h-12 w-12 place-items-center rounded-full bg-navy-100 font-bold text-navy">
              {initials(emp.firstName, emp.lastName)}
            </span>
            <div>
              <p className="font-bold">
                {emp.firstName} {emp.lastName}
              </p>
              <p className="text-xs text-muted">รหัสพนักงาน {emp.employeeCode}</p>
            </div>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            <Info label="แผนก" value={emp.department} />
            <Info label="แผนกย่อย" value={emp.subDepartment ?? "-"} />
            <Info label="ตำแหน่ง" value={emp.position} />
            <Info label="เพศ" value={emp.gender === "FEMALE" ? "หญิง" : "ชาย"} />
            <Info label="ผู้บังคับบัญชา" value={emp.managerName ?? "-"} />
            <Info label="สาขาที่รับสินค้า" value={emp.branch?.name ?? "-"} />
          </dl>
          <p className="mt-3 text-xs text-muted">ข้อมูลแผนกและตำแหน่งมาจากฝ่ายบุคคล หากไม่ถูกต้องโปรดแจ้ง HR</p>
        </Card>

        <Card className="p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-semibold">สิทธิ์ของฉัน</p>
            <span className="text-xs text-muted">{view ? roundLabel(view.round) : ""}</span>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-muted">
                <th className="px-2 py-1.5 text-left font-medium">เครื่องแบบ</th>
                <th className="px-1 py-1.5 font-medium">สิทธิ์</th>
                <th className="px-1 py-1.5 font-medium">สั่งแล้ว</th>
                <th className="px-1 py-1.5 font-medium">คงเหลือ</th>
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
                      <span className={cx("inline-block min-w-7 rounded px-1.5 text-xs font-semibold", left ? "bg-accent-50 text-accent" : "bg-ok-50 text-ok")}>
                        {left}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">สิทธิ์ที่ไม่ได้ใช้ไม่สะสมไปรอบถัดไป</p>
        </Card>

        <Card className="divide-y divide-line text-sm">
          <Row label="เบอร์โทร" value={maskPhone(emp.phone)} />
          <Row label="อีเมล" value={maskEmail(emp.email)} />
          <details className="px-3 py-2.5">
            <summary className="flex cursor-pointer justify-between">
              ที่อยู่สำหรับส่งที่บ้าน <span className="text-muted">{emp.homeAddress ? "ตั้งค่าแล้ว" : "ยังไม่ได้ตั้ง"}</span>
            </summary>
            <AddressForm initial={emp.homeAddress ?? ""} />
          </details>
          <Link href="/notifications" className="flex justify-between px-3 py-2.5">
            การแจ้งเตือน
            <span className="text-muted">{[emp.notifyEmail && "อีเมล", emp.notifySms && "SMS", emp.notifyLine && "LINE"].filter(Boolean).join(", ") || "ปิด"}</span>
          </Link>
          <details className="px-3 py-2.5">
            <summary className="cursor-pointer">เปลี่ยนรหัสผ่าน</summary>
            <PasswordForm />
          </details>
          <form action={logout} className="px-3 py-2.5">
            <button className="font-semibold text-bad">ออกจากระบบ</button>
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
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-3 py-2.5">
      {label}
      <span className="text-muted">{value}</span>
    </div>
  );
}
