import Link from "next/link";
import { db } from "@/lib/db";
import { thDate, thDateTime, toLocalInput } from "@/lib/format";
import { DEPARTMENTS, PACKING_LABEL } from "@/lib/portal-labels";
import { viewOf } from "@/lib/portal";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Input, Label, Select } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { closeRoundNow, createRound, markRoundClosed, remindNotOrdered, saveRoundPolicies, saveTimelineSettings, updateRound } from "../../actions";
import { eligibleWhere, selectedRound } from "../../lib";
import { ActionForm } from "../form-bits";
import { ExtendForm } from "./extend-form";
import { PolicyRows } from "./policy-rows";

export default async function RoundsPage({ searchParams }: { searchParams: Promise<{ round?: string; reminded?: string }> }) {
  const { round: roundParam, reminded } = await searchParams;
  const [{ rounds, round, view }, settings] = await Promise.all([selectedRound(roundParam), getSettings()]);
  const [eligible, registered, ordered, counts, deptCounts] = round
    ? await Promise.all([
        db.employee.count({ where: eligibleWhere(round) }),
        db.employee.count({ where: { AND: [eligibleWhere(round), { registeredAt: { not: null } }] } }),
        db.order.count({ where: { roundId: round.id } }),
        db.order.groupBy({ by: ["roundId"], _count: true }),
        db.employee.groupBy({ by: ["department"], where: eligibleWhere(round), _count: true }),
      ])
    : [0, 0, 0, [], []];
  const pct = (n: number) => (eligible ? (n / eligible) * 100 : 0);
  const orderCount = (id: string) => counts.find((c) => c.roundId === id)?._count ?? 0;
  const year = new Date().getFullYear();

  return (
    <div className="max-w-5xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-medium">รอบสั่งซื้อและเครดิต</h1>
          <p className="text-sm text-muted">Big Lot ปีละครั้ง และ New Joiners รายเดือน · ตั้งเครดิตได้ทีละรอบ ทีละแผนก</p>
        </div>
        <a href="#create" className="rounded-lg bg-navy px-3 py-2 text-sm text-white">
          + สร้างรอบใหม่
        </a>
      </div>
      {reminded && <p className="rounded-lg bg-ok-50 px-3 py-2 text-sm text-ok">ส่งแจ้งเตือนถึงพนักงานที่ยังไม่สั่ง {reminded} คนแล้ว</p>}

      {round && view && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-medium">{round.name}</h2>
                  <Badge tone="gray">ประเภท: {round.type === "BIG_LOT" ? "Big Lot" : "New Joiners"}</Badge>
                  <Badge tone={view.phase === "OPEN" ? "ok" : view.phase === "UPCOMING" ? "navy" : "gray"}>
                    {view.phase === "OPEN" ? "● เปิดรับ" : view.phase === "UPCOMING" ? "ยังไม่เปิด" : "ปิดรับแล้ว"}
                  </Badge>
                </div>
                <p className="text-sm text-muted">พนักงานเห็นวันปิดรับนี้ในหน้าแรกและหน้าเข้าสู่ระบบ</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="#extend" className="rounded-lg border border-navy/40 px-3 py-2 text-sm text-navy">
                  ขยายเวลา
                </a>
                <form action={remindNotOrdered}>
                  <input type="hidden" name="id" value={round.id} />
                  <SubmitButton variant="secondary" className="h-9">
                    ส่งแจ้งเตือนผู้ที่ยังไม่สั่ง
                  </SubmitButton>
                </form>
                {view.phase === "OPEN" ? (
                  <form action={closeRoundNow}>
                    <input type="hidden" name="id" value={round.id} />
                    <SubmitButton variant="danger" className="h-9">
                      ปิดรอบตอนนี้
                    </SubmitButton>
                  </form>
                ) : view.phase === "CLOSED" ? (
                  <form action={markRoundClosed}>
                    <input type="hidden" name="id" value={round.id} />
                    <SubmitButton variant="secondary" className="h-9">
                      เปลี่ยนสถานะเป็น &ldquo;ปิดรอบสั่งซื้อ&rdquo;
                    </SubmitButton>
                  </form>
                ) : null}
              </div>
            </div>

            <ActionForm action={updateRound} submit="บันทึก" variant="secondary" className="mt-4">
              <input type="hidden" name="id" value={round.id} />
              <div className="grid gap-3 md:grid-cols-3">
                <div>
                  <Label>วันเปิดรับ</Label>
                  <Input type="datetime-local" name="opensAt" defaultValue={toLocalInput(round.opensAt)} />
                </div>
                <div>
                  <Label>วันปิดรับ</Label>
                  <Input type="datetime-local" name="closesAt" defaultValue={toLocalInput(round.closesAt)} />
                </div>
                <div>
                  <Label>การแก้ไขคำสั่งซื้อ</Label>
                  <label className="flex h-11 items-center gap-2 text-sm">
                    <input type="checkbox" name="allowEdits" defaultChecked={round.allowEdits} className="h-4 w-4 accent-navy" />
                    ให้พนักงานแก้ไขได้จนปิดรอบ
                  </label>
                </div>
                <div>
                  <Label>ส่งถึงที่ทำงานภายใน (วันหลังปิดรอบ)</Label>
                  <Input type="number" name="deliveryDays" defaultValue={round.deliveryDays} min={1} />
                </div>
                <div>
                  <Label>การบรรจุ</Label>
                  <Select name="packing" defaultValue={round.packing}>
                    {Object.entries(PACKING_LABEL).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            </ActionForm>

            <div className="mt-4">
              <div className="flex justify-between text-sm">
                <span className="font-medium">ความคืบหน้า</span>
                <span className="text-muted">
                  สั่งแล้ว {ordered} จาก {eligible} คน · {Math.round(pct(ordered))}%
                </span>
              </div>
              <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-cream">
                <div className="bg-ok" style={{ width: `${pct(ordered)}%` }} />
                <div className="bg-[#e3b47a]" style={{ width: `${pct(Math.max(0, registered - ordered))}%` }} />
              </div>
              <div className="mt-1.5 flex flex-wrap gap-4 text-xs text-muted">
                <span>
                  <span className="text-ok">●</span> สั่งแล้ว {ordered}
                </span>
                <span>
                  <span className="text-[#e3b47a]">●</span> ลงทะเบียนแล้ว ยังไม่สั่ง {Math.max(0, registered - ordered)}
                </span>
                <span>
                  <span className="text-gray-300">●</span> ยังไม่ลงทะเบียน {eligible - registered}
                </span>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <ActionForm action={saveRoundPolicies} submit="บันทึกสิทธิ์และเครดิต" variant="secondary">
              <input type="hidden" name="id" value={round.id} />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-medium">สิทธิ์และเครดิตของรอบนี้</h2>
                  <p className="text-sm text-muted">ตั้งค่าแยกตามแผนก · เครดิตไม่สะสมไปรอบถัดไป · ส่วนที่เกินพนักงานชำระเอง</p>
                </div>
                <label className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-sm">
                  <input type="checkbox" name="creditEnabled" defaultChecked={round.creditEnabled} className="h-4 w-4 accent-navy" />
                  ระบบเครดิต (ทุกแผนก)
                </label>
              </div>
              <PolicyRows
                rows={DEPARTMENTS.map((d) => {
                  const p = round.policies.find((x) => x.department === d);
                  return {
                    department: d,
                    mode: p?.mode ?? "FIXED",
                    credit: p?.creditAmount ?? 0,
                    people: deptCounts.find((c) => c.department === d)?._count ?? 0,
                  };
                })}
              />
              <p className="mt-2 text-xs text-muted">
                ตามสิทธิ์ = พนักงานเห็นรายการเครื่องแบบที่ได้รับ (กำหนดในหน้าสิทธิ์เครื่องแบบ ตามตำแหน่งและอายุงาน) · เครดิต = พนักงานเลือกสินค้าที่ &ldquo;ใช้เครดิตได้&rdquo; จนครบวงเงิน ·
                ปิดระบบเครดิต = ทุกแผนกใช้แบบตามสิทธิ์
              </p>
            </ActionForm>
          </Card>

          <Card id="extend" className="border-navy/40 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-medium">ขยายเวลาปิดรับ</h2>
                <p className="text-sm text-muted">ใช้เมื่อต้องปรับไทม์ไลน์ ระบบคำนวณวันจัดส่งใหม่ให้อัตโนมัติ · ขยายเฉพาะบุคคลได้จากหน้าพนักงาน</p>
              </div>
              <Badge tone="accent">ขยายแล้ว {round.extensions.length} ครั้ง</Badge>
            </div>
            <ExtendForm
              roundId={round.id}
              currentClose={(round.closedEarlyAt ?? round.closesAt).toISOString()}
              opensAt={round.opensAt.toISOString()}
              deliveryDays={round.deliveryDays}
              departments={[...DEPARTMENTS]}
            />
            {round.extensions.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-1 text-sm font-medium">ประวัติการขยายเวลา</p>
                <ul className="space-y-1 text-sm text-muted">
                  {round.extensions.map((e) => (
                    <li key={e.id}>
                      {thDateTime(e.createdAt)} · {e.createdBy}: {thDateTime(e.previousClosesAt)} → <b className="text-ink">{thDateTime(e.newClosesAt)}</b> ·{" "}
                      {e.scope === "ALL" ? "ทุกคน" : e.scope === "DEPARTMENT" ? `แผนก ${e.department}` : `${e.employeeIds.length} คนที่เลือก`} · {e.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </>
      )}

      <Card className="p-4">
        <h2 className="font-medium">ไทม์ไลน์และค่าเริ่มต้น</h2>
        <ActionForm action={saveTimelineSettings} submit="บันทึก" variant="secondary" className="mt-3">
          <div className="grid gap-3 md:grid-cols-4">
            <div>
              <Label>เปิดรับคำสั่งซื้อ (วัน)</Label>
              <Input type="number" name="openDays" defaultValue={settings.openDays} min={1} />
            </div>
            <div>
              <Label>จัดส่งภายใน (วันหลังปิดรอบ)</Label>
              <Input type="number" name="deliveryDays" defaultValue={settings.deliveryDays} min={1} />
            </div>
            <div>
              <Label>เครดิต Back Office เริ่มต้น</Label>
              <Input type="number" name="backOfficeCredit" defaultValue={settings.backOfficeCredit} min={0} />
            </div>
            <div>
              <Label>ค่าส่งที่บ้าน Personal (บาท)</Label>
              <Input type="number" name="homeDeliveryFee" defaultValue={settings.homeDeliveryFee} min={0} />
            </div>
          </div>
        </ActionForm>
      </Card>

      <Card id="create" className="p-4">
        <h2 className="font-medium">สร้างรอบ Big Lot</h2>
        <p className="text-sm text-muted">
          รอบ New Joiners รายเดือนสร้างได้ที่หน้า{" "}
          <Link href="/admin/new-joiners" className="text-navy underline">
            New Joiners
          </Link>
        </p>
        <ActionForm action={createRound} submit="+ สร้างรอบ" className="mt-3">
          <input type="hidden" name="openDays" value={settings.openDays} />
          <input type="hidden" name="deliveryDays" value={settings.deliveryDays} />
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>ชื่อรอบ</Label>
              <Input name="name" defaultValue={`Big Lot ${year + 1}`} />
            </div>
            <div>
              <Label>วันเปิดรับ</Label>
              <Input type="datetime-local" name="opensAt" required />
            </div>
            <div>
              <Label>การบรรจุ</Label>
              <Select name="packing" defaultValue="PER_PERSON">
                {Object.entries(PACKING_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="notify" className="h-4 w-4 accent-navy" /> แจ้ง &ldquo;เปิดให้สั่งจอง&rdquo; ทาง SMS / อีเมล ทันที
          </label>
          <p className="mt-1 text-xs text-muted">
            ปิดรับอัตโนมัติ 23:59 ของวันที่ {settings.openDays} · Back Office ได้เครดิต ฿{settings.backOfficeCredit.toLocaleString("th-TH")} (แก้ได้หลังสร้าง)
          </p>
        </ActionForm>
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="px-4 pt-4 font-medium">รอบทั้งหมด</h2>
        <table className="mt-2 w-full min-w-[680px] text-sm">
          <thead className="bg-cream text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-normal">รอบ</th>
              <th className="px-4 py-2 font-normal">ช่วงเวลา</th>
              <th className="px-4 py-2 font-normal">คำสั่งซื้อ</th>
              <th className="px-4 py-2 font-normal">สถานะ</th>
              <th />
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
                    <span className="block text-xs text-muted">ส่งภายใน {thDate(v.deliveryDue)}</span>
                  </td>
                  <td className="px-4 py-2">{orderCount(r.id).toLocaleString("th-TH")}</td>
                  <td className="px-4 py-2">
                    <Badge tone={v.phase === "OPEN" ? "ok" : v.phase === "UPCOMING" ? "navy" : "gray"}>
                      {v.phase === "OPEN" ? "เปิดรับ" : v.phase === "UPCOMING" ? "ยังไม่เปิด" : "ปิดรับแล้ว"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <a href={`/admin/reports/production?round=${r.id}`} className="text-navy">
                      ดาวน์โหลด CSV
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
