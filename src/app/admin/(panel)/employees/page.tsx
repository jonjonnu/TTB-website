import Link from "next/link";
import { db } from "@/lib/db";
import { yearsOfService } from "@/lib/entitlements";
import { toLocalInput } from "@/lib/format";
import { DEPARTMENTS, STATUS_LABEL } from "@/lib/portal-labels";
import { Card, Input, Select, cx } from "@/components/ui";
import { importEmployees, importTracking } from "../../actions";
import { eligibleWhere, employeeWhere, selectedRound, type EmployeeFilters } from "../../lib";
import { ActionForm } from "../form-bits";
import { EmployeeTable } from "./table";

const TABS = [
  ["all", "ทั้งหมด"],
  ["ordered", "สั่งซื้อแล้ว"],
  ["not-ordered", "ยังไม่สั่ง"],
  ["unregistered", "ยังไม่ลงทะเบียน"],
] as const;

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<EmployeeFilters & { page?: string; round?: string }> }) {
  const f = await searchParams;
  const { rounds, round, view } = await selectedRound(f.round);
  const page = Math.max(1, Number(f.page ?? 1));
  const where = employeeWhere(f, round);
  const base = eligibleWhere(round);
  const roundId = round?.id;

  const [eligible, ordered, registered, filtered, employees, subDepartments, locations] = await Promise.all([
    db.employee.count({ where: base }),
    roundId ? db.order.count({ where: { roundId } }) : 0,
    db.employee.count({ where: { AND: [base, { registeredAt: { not: null } }] } }),
    db.employee.count({ where }),
    db.employee.findMany({
      where,
      include: { orders: roundId ? { where: { roundId }, select: { id: true, status: true, trackingNumber: true, carrier: true } } : false },
      orderBy: { employeeCode: "asc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
    db.employee.findMany({ distinct: ["subDepartment"], select: { subDepartment: true }, orderBy: { subDepartment: "asc" } }),
    db.employee.findMany({ distinct: ["workLocation"], select: { workLocation: true }, orderBy: { workLocation: "asc" } }),
  ]);
  const params = Object.entries(f).filter(([k, v]) => v && k !== "page") as [string, string][];
  const qs = (extra: Record<string, string>) => new URLSearchParams({ ...Object.fromEntries(params), ...extra }).toString();
  const notOrdered = Math.max(0, registered - ordered);

  return (
    <div className="max-w-7xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-medium">พนักงานและคำสั่งซื้อ</h1>
          <p className="text-sm text-muted">{round ? `${round.name} · ` : ""}ข้อมูลพนักงานนำเข้าจาก HR (CSV)</p>
        </div>
        <div className="flex gap-2">
          <a href="#import" className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
            ↑ นำเข้า CSV
          </a>
          <a href={`/admin/export/employees?${qs({})}`} className="rounded-lg bg-navy px-3 py-2 text-sm text-white">
            ↓ ดาวน์โหลด CSV ({filtered})
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="ผู้มีสิทธิ์ในรอบนี้" value={eligible} />
        <Stat label="สั่งซื้อแล้ว" value={ordered} tone="ok" />
        <Stat label="ลงทะเบียนแล้ว ยังไม่สั่ง" value={notOrdered} tone="accent" />
        <Stat label="ยังไม่ลงทะเบียน" value={eligible - registered} />
      </div>

      <Card>
        <div className="flex gap-1 overflow-x-auto border-b border-line px-3">
          {TABS.map(([key, label]) => (
            <Link
              key={key}
              href={`/admin/employees?${qs({ tab: key })}`}
              className={cx("shrink-0 border-b-2 px-3 py-3 text-sm", (f.tab ?? "all") === key ? "border-navy font-medium" : "border-transparent text-muted")}
            >
              {label}
            </Link>
          ))}
        </div>
        <form className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4 lg:grid-cols-8">
          {f.tab && <input type="hidden" name="tab" value={f.tab} />}
          <Input name="q" defaultValue={f.q} placeholder="ค้นหารหัส ชื่อ หรือเลขพัสดุ" className="col-span-2" />
          <Select name="round" defaultValue={roundId}>
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Select name="department" defaultValue={f.department ?? ""}>
            <option value="">แผนก: ทั้งหมด</option>
            {DEPARTMENTS.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </Select>
          <Select name="subDepartment" defaultValue={f.subDepartment ?? ""}>
            <option value="">หน่วยงาน: ทั้งหมด</option>
            {subDepartments.filter((d) => d.subDepartment).map((d) => (
              <option key={d.subDepartment}>{d.subDepartment}</option>
            ))}
          </Select>
          <Select name="workLocation" defaultValue={f.workLocation ?? ""}>
            <option value="">Work Location: ทั้งหมด</option>
            {locations.filter((d) => d.workLocation).map((d) => (
              <option key={d.workLocation}>{d.workLocation}</option>
            ))}
          </Select>
          <Select name="years" defaultValue={f.years ?? ""}>
            <option value="">อายุงาน: ทั้งหมด</option>
            <option value="0-1">น้อยกว่า 1 ปี</option>
            <option value="1-3">1–3 ปี</option>
            <option value="3-5">3–5 ปี</option>
            <option value="5+">5 ปีขึ้นไป</option>
          </Select>
          <Select name="status" defaultValue={f.status ?? ""}>
            <option value="">สถานะคำสั่งซื้อ: ทั้งหมด</option>
            {Object.entries(STATUS_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </Select>
          <div className="col-span-2 flex gap-2 md:col-span-4 lg:col-span-8">
            <button className="rounded-lg bg-navy px-4 py-2 text-sm text-white">กรอง</button>
            <Link href="/admin/employees" className="rounded-lg px-4 py-2 text-sm text-muted">
              ล้างตัวกรอง
            </Link>
            <span className="ml-auto self-center text-sm text-muted">พบ {filtered.toLocaleString("th-TH")} คน</span>
          </div>
        </form>
        <EmployeeTable
          roundId={roundId ?? ""}
          defaultClose={view ? toLocalInput(new Date(view.closeAt.getTime() + 3 * 86400_000)) : ""}
          rows={employees.map((e) => {
            const o = e.orders?.[0];
            return {
              id: e.id,
              code: e.employeeCode,
              name: `${e.firstName} ${e.lastName}`,
              department: e.department,
              subDepartment: e.subDepartment,
              workLocation: e.workLocation,
              years: e.startDate ? yearsOfService(e.startDate) : null,
              registered: !!e.registeredAt,
              orderId: o?.id ?? null,
              status: o?.status ?? null,
              tracking: o?.trackingNumber ? `${o.carrier ?? ""} ${o.trackingNumber}`.trim() : null,
            };
          })}
        />
        <div className="flex items-center justify-between border-t border-line px-3 py-2 text-sm">
          <span className="text-xs text-muted">
            แสดง {employees.length} จาก {filtered.toLocaleString("th-TH")} คน · คลิกสถานะเพื่อดูคำสั่งซื้อ
          </span>
          <span className="flex gap-2">
            {page > 1 && (
              <Link href={`/admin/employees?${qs({ page: String(page - 1) })}`} className="rounded-lg border border-line px-3 py-1">
                ก่อนหน้า
              </Link>
            )}
            {page * 50 < filtered && (
              <Link href={`/admin/employees?${qs({ page: String(page + 1) })}`} className="rounded-lg border border-line px-3 py-1">
                ถัดไป
              </Link>
            )}
          </span>
        </div>
      </Card>

      <div id="import" className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h2 className="font-medium">นำเข้าพนักงานจาก HR (CSV)</h2>
          <p className="mt-1 text-xs text-muted">
            คอลัมน์: employee_code, first_name, last_name, gender (M/F), department (Branch / Wealth / Back Office), sub_department, position, manager,
            start_date (YYYY-MM-DD), work_location, work_address, email, phone · รหัสเดิมจะถูกอัปเดต ·{" "}
            <a href="/employees-template.csv" className="text-navy underline">
              ไฟล์ตัวอย่าง
            </a>
          </p>
          <ActionForm action={importEmployees} submit="นำเข้า" className="mt-3">
            <input type="file" name="file" accept=".csv,text/csv" className="text-sm" />
          </ActionForm>
        </Card>
        <Card className="p-4">
          <h2 className="font-medium">ใส่เลขพัสดุ J&T ทีละกลุ่ม (CSV)</h2>
          <p className="mt-1 text-xs text-muted">
            คอลัมน์: order_number (หรือ employee_code สำหรับรอบที่เลือก), tracking_number, carrier (ไม่บังคับ) · ระบบเปลี่ยนสถานะเป็น &ldquo;อยู่ระหว่างจัดส่ง&rdquo; และแจ้งพนักงานอัตโนมัติ ·{" "}
            <a href="/tracking-template.csv" className="text-navy underline">
              ไฟล์ตัวอย่าง
            </a>
          </p>
          <ActionForm action={importTracking} submit="อัปโหลดเลขพัสดุ" className="mt-3">
            <input type="hidden" name="roundId" value={roundId ?? ""} />
            <input type="file" name="file" accept=".csv,text/csv" className="text-sm" />
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" | "accent" }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className={cx("font-latin text-2xl font-medium", tone === "ok" && "text-ok", tone === "accent" && "text-accent")}>{value.toLocaleString("th-TH")}</p>
    </Card>
  );
}
