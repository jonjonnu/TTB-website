import Link from "next/link";
import { db } from "@/lib/db";
import { fromLocalInput, thDate, toLocalInput } from "@/lib/format";
import { viewOf } from "@/lib/portal";
import { serviceLabel } from "@/lib/entitlements";
import { getSettings } from "@/lib/settings";
import { DAY } from "@/lib/rounds";
import { Badge, Card, Input, Label, Textarea } from "@/components/ui";
import { openNewJoinersRound } from "../../actions";
import { ActionForm } from "../form-bits";

const MONTHS = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export default async function NewJoinersPage() {
  const now = new Date();
  const year = now.getFullYear();
  const settings = await getSettings();
  const [bigLot, rounds, candidates] = await Promise.all([
    db.orderRound.findFirst({ where: { type: "BIG_LOT" }, orderBy: { opensAt: "desc" } }),
    db.orderRound.findMany({
      where: { type: "NEW_JOINERS" },
      include: { extensions: true, policies: true, _count: { select: { members: true, orders: true } } },
      orderBy: { opensAt: "desc" },
      take: 12,
    }),
    // Nobody who already has a welfare order this year, or was already picked for a New Joiners round this year.
    db.employee.findMany({
      where: {
        active: true,
        orders: { none: { kind: "WELFARE", round: { year } } },
        roundMembers: { none: { round: { year } } },
      },
      orderBy: [{ startDate: "desc" }, { employeeCode: "asc" }],
      take: 100,
    }),
  ]);
  // Pre-tick people who started in the last 90 days.
  const joinedAfter = new Date(now.getTime() - 90 * DAY);
  // Tomorrow 09:00 to 23:59 on the last open day, Bangkok time.
  const tomorrow = toLocalInput(new Date(now.getTime() + DAY)).slice(0, 10);
  const opens = fromLocalInput(`${tomorrow}T09:00`);
  const lastDay = toLocalInput(new Date(opens.getTime() + (settings.openDays - 1) * DAY)).slice(0, 10);
  const closes = fromLocalInput(`${lastDay}T23:59`);

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-medium">New Joiners รายเดือน</h1>
        <p className="text-sm text-muted">
          เลือกพนักงานใหม่ที่ยังไม่ได้รับเครื่องแบบปีนี้ แล้วเปิดรอบให้เฉพาะคนกลุ่มนี้ · ใช้สิทธิ์และเครดิตเดียวกับ {bigLot?.name ?? "Big Lot ล่าสุด"}
        </p>
      </div>

      <Card className="p-4">
        <ActionForm action={openNewJoinersRound} submit="เปิดรอบให้คนที่เลือก">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>ชื่อรอบ</Label>
              <Input name="name" defaultValue={`New Joiners ${MONTHS[now.getMonth()]} ${year}`} />
            </div>
            <div>
              <Label>วันเปิดรับ</Label>
              <Input type="datetime-local" name="opensAt" defaultValue={toLocalInput(opens)} />
            </div>
            <div>
              <Label>วันปิดรับ</Label>
              <Input type="datetime-local" name="closesAt" defaultValue={toLocalInput(closes)} />
            </div>
          </div>

          <div className="mt-4 flex items-end justify-between">
            <div>
              <h2 className="font-medium">รายชื่อที่แนะนำ ({candidates.length})</h2>
              <p className="text-xs text-muted">ยังไม่มีคำสั่งซื้อสวัสดิการปี {year} · ติ๊กไว้แล้วสำหรับคนที่เริ่มงานหลัง {thDate(joinedAfter)}</p>
            </div>
          </div>
          <div className="mt-2 max-h-[420px] overflow-auto rounded-lg border border-line">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-cream text-left text-xs text-muted">
                <tr>
                  <th className="w-10 px-3 py-2" />
                  <th className="px-3 py-2 font-normal">พนักงาน</th>
                  <th className="px-3 py-2 font-normal">แผนก / ตำแหน่ง</th>
                  <th className="px-3 py-2 font-normal">เริ่มงาน</th>
                  <th className="px-3 py-2 font-normal">สถานที่ทำงาน</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((e) => (
                  <tr key={e.id} className="border-t border-line">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        name="employeeId"
                        value={e.id}
                        defaultChecked={!!e.startDate && e.startDate > joinedAfter}
                        className="h-4 w-4 accent-navy"
                        aria-label={`เลือก ${e.firstName}`}
                      />
                    </td>
                    <td className="px-3 py-2">
                      {e.firstName} {e.lastName}
                      <span className="block text-xs text-muted">{e.employeeCode}{!e.registeredAt && " · ยังไม่ลงทะเบียน"}</span>
                    </td>
                    <td className="px-3 py-2">
                      {e.department}
                      <span className="block text-xs text-muted">{e.position}</span>
                    </td>
                    <td className="px-3 py-2">
                      {e.startDate ? thDate(e.startDate) : "-"}
                      <span className="block text-xs text-muted">{serviceLabel(e.startDate)}</span>
                    </td>
                    <td className="px-3 py-2">{e.workLocation ?? "-"}</td>
                  </tr>
                ))}
                {candidates.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted">
                      ทุกคนได้รับเครื่องแบบปีนี้แล้ว
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <Label>เพิ่มด้วยรหัสพนักงาน</Label>
              <Textarea name="codes" rows={2} placeholder="เช่น 1100301, 1100302" />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" name="notify" defaultChecked className="h-4 w-4 accent-navy" />
              แจ้ง &ldquo;เปิดให้สั่งจอง&rdquo; ทาง SMS / อีเมล เมื่อเปิดรอบ
            </label>
          </div>
        </ActionForm>
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="px-4 pt-4 font-medium">รอบ New Joiners ที่ผ่านมา</h2>
        <table className="mt-2 w-full min-w-[600px] text-sm">
          <thead className="bg-cream text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-normal">รอบ</th>
              <th className="px-4 py-2 font-normal">ช่วงเวลา</th>
              <th className="px-4 py-2 font-normal">สั่งแล้ว</th>
              <th className="px-4 py-2 font-normal">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => {
              const v = viewOf(r);
              return (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-4 py-2">
                    <Link href={`/admin/rounds?round=${r.id}`} className="font-medium text-navy">
                      {r.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    {thDate(r.opensAt)} – {thDate(v.closeAt)}
                  </td>
                  <td className="px-4 py-2">
                    {r._count.orders} / {r._count.members} คน
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone={v.phase === "OPEN" ? "ok" : v.phase === "UPCOMING" ? "navy" : "gray"}>
                      {v.phase === "OPEN" ? "เปิดรับ" : v.phase === "UPCOMING" ? "ยังไม่เปิด" : "ปิดรับแล้ว"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
            {rounds.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted">
                  ยังไม่มีรอบ New Joiners
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
