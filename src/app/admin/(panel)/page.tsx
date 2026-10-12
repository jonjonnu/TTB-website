import Link from "next/link";
import { db } from "@/lib/db";
import { thDate } from "@/lib/format";
import { currentRound } from "@/lib/portal";
import { roundLabel } from "@/lib/rounds";
import { Badge, Card, Input, Select } from "@/components/ui";
import { importEmployees } from "../actions";
import { employeeWhere, type EmployeeFilters } from "../lib";
import { ActionForm } from "./form-bits";

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<EmployeeFilters & { page?: string }> }) {
  const f = await searchParams;
  const view = await currentRound();
  const roundId = view?.round.id ?? null;
  const page = Math.max(1, Number(f.page ?? 1));
  const where = employeeWhere(f, roundId);

  const [total, registered, ordered, filtered, employees, departments, subDepartments, positions] = await Promise.all([
    db.employee.count({ where: { active: true } }),
    db.employee.count({ where: { active: true, registeredAt: { not: null } } }),
    roundId ? db.order.count({ where: { roundId } }) : Promise.resolve(0),
    db.employee.count({ where }),
    db.employee.findMany({
      where,
      include: { orders: roundId ? { where: { roundId }, select: { id: true, status: true } } : false, branch: true },
      orderBy: { employeeCode: "asc" },
      skip: (page - 1) * 50,
      take: 50,
    }),
    db.employee.findMany({ distinct: ["department"], select: { department: true }, orderBy: { department: "asc" } }),
    db.employee.findMany({ distinct: ["subDepartment"], select: { subDepartment: true }, orderBy: { subDepartment: "asc" } }),
    db.employee.findMany({ distinct: ["position"], select: { position: true }, orderBy: { position: "asc" } }),
  ]);
  const qs = new URLSearchParams(Object.entries(f).filter(([k, v]) => v && k !== "page") as [string, string][]).toString();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold">พนักงานและสถานะ</h1>
        <a href={`/admin/export/employees?${qs}`} className="rounded-lg border border-navy/30 bg-white px-3 py-2 text-sm font-semibold text-navy">
          ดาวน์โหลด CSV ({filtered})
        </a>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="พนักงานทั้งหมด" value={total} />
        <Stat label="ลงทะเบียนแล้ว" value={registered} sub={`${total ? Math.round((registered / total) * 100) : 0}%`} />
        <Stat label="ยังไม่ลงทะเบียน" value={total - registered} />
        <Stat label={view ? `สั่งแล้ว · ${roundLabel(view.round)}` : "สั่งแล้ว"} value={ordered} />
      </div>

      <Card className="p-3">
        <form className="grid grid-cols-2 gap-2 md:grid-cols-4 lg:grid-cols-8">
          <Input name="q" defaultValue={f.q} placeholder="ค้นหารหัส / ชื่อ" className="col-span-2" />
          <Select name="department" defaultValue={f.department ?? ""}>
            <option value="">ทุกแผนก</option>
            {departments.map((d) => (
              <option key={d.department}>{d.department}</option>
            ))}
          </Select>
          <Select name="subDepartment" defaultValue={f.subDepartment ?? ""}>
            <option value="">ทุกแผนกย่อย</option>
            {subDepartments.filter((d) => d.subDepartment).map((d) => (
              <option key={d.subDepartment}>{d.subDepartment}</option>
            ))}
          </Select>
          <Select name="gender" defaultValue={f.gender ?? ""}>
            <option value="">ทุกเพศ</option>
            <option value="FEMALE">หญิง</option>
            <option value="MALE">ชาย</option>
          </Select>
          <Select name="position" defaultValue={f.position ?? ""}>
            <option value="">ทุกตำแหน่ง</option>
            {positions.map((d) => (
              <option key={d.position}>{d.position}</option>
            ))}
          </Select>
          <Select name="registered" defaultValue={f.registered ?? ""}>
            <option value="">การลงทะเบียน</option>
            <option value="yes">ลงทะเบียนแล้ว</option>
            <option value="no">ยังไม่ลงทะเบียน</option>
          </Select>
          <Select name="ordered" defaultValue={f.ordered ?? ""}>
            <option value="">การสั่งซื้อรอบนี้</option>
            <option value="yes">สั่งแล้ว</option>
            <option value="no">ยังไม่สั่ง</option>
          </Select>
          <div className="col-span-2 flex gap-2 md:col-span-4 lg:col-span-8">
            <button className="rounded-lg bg-navy px-4 py-2 text-sm font-semibold text-white">กรอง</button>
            <Link href="/admin" className="rounded-lg px-4 py-2 text-sm text-muted">
              ล้างตัวกรอง
            </Link>
            <span className="ml-auto self-center text-sm text-muted">พบ {filtered} คน</span>
          </div>
        </form>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50 text-left text-xs text-muted">
            <tr>
              {["รหัส", "ชื่อ", "แผนก", "ตำแหน่ง", "เพศ", "สาขา", "ลงทะเบียน", "รอบนี้"].map((h) => (
                <th key={h} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => {
              const o = e.orders?.[0];
              return (
                <tr key={e.id} className="border-t border-line">
                  <td className="px-3 py-2 font-mono text-xs">{e.employeeCode}</td>
                  <td className="px-3 py-2">
                    {e.firstName} {e.lastName}
                  </td>
                  <td className="px-3 py-2">
                    {e.department}
                    {e.subDepartment && <span className="block text-xs text-muted">{e.subDepartment}</span>}
                  </td>
                  <td className="px-3 py-2">{e.position}</td>
                  <td className="px-3 py-2">{e.gender === "FEMALE" ? "หญิง" : "ชาย"}</td>
                  <td className="px-3 py-2">{e.branch?.name ?? "-"}</td>
                  <td className="px-3 py-2">
                    {e.registeredAt ? <Badge tone="ok">{thDate(e.registeredAt)}</Badge> : <Badge tone="gray">ยังไม่ลงทะเบียน</Badge>}
                  </td>
                  <td className="px-3 py-2">
                    {o ? (
                      <Link href={`/admin/orders/${o.id}`}>
                        <Badge tone="navy">สั่งแล้ว</Badge>
                      </Link>
                    ) : (
                      <Badge tone="accent">ยังไม่สั่ง</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex justify-between border-t border-line px-3 py-2 text-sm">
          {page > 1 ? <Link href={`/admin?${qs}&page=${page - 1}`} className="text-navy">‹ ก่อนหน้า</Link> : <span />}
          {page * 50 < filtered ? <Link href={`/admin?${qs}&page=${page + 1}`} className="text-navy">ถัดไป ›</Link> : <span />}
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="font-semibold">นำเข้าพนักงานจาก CSV</h2>
        <p className="mt-1 text-sm text-muted">
          คอลัมน์: <code className="text-xs">employee_code, first_name, last_name, gender (M/F), department, sub_department, position, manager, email, phone, branch_code</code>{" "}
          · รหัสที่มีอยู่แล้วจะถูกอัปเดต ·{" "}
          <a href="/employees-template.csv" className="text-navy underline">
            ดาวน์โหลดไฟล์ตัวอย่าง
          </a>
        </p>
        <ActionForm action={importEmployees} submit="นำเข้า" className="mt-3">
          <input type="file" name="file" accept=".csv,text/csv" className="text-sm" />
        </ActionForm>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-bold">
        {value.toLocaleString("th-TH")} {sub && <span className="text-sm font-normal text-muted">{sub}</span>}
      </p>
    </Card>
  );
}
