import { db } from "@/lib/db";
import { thDate, thDateTime, toLocalInput } from "@/lib/format";
import { currentRound } from "@/lib/portal";
import { deliveryDueAt, roundLabel, roundPhase, effectiveCloseAt } from "@/lib/rounds";
import { getSettings } from "@/lib/settings";
import { Badge, Card, Input, Label } from "@/components/ui";
import { SubmitButton } from "@/components/forms";
import { closeRoundNow, createRound, remindNotOrdered, saveTimelineSettings, updateRound } from "../../actions";
import { ActionForm } from "../form-bits";
import { ExtendForm } from "./extend-form";

export default async function RoundsPage({ searchParams }: { searchParams: Promise<{ reminded?: string }> }) {
  const { reminded } = await searchParams;
  const [view, settings, rounds, departments] = await Promise.all([
    currentRound(),
    getSettings(),
    db.orderRound.findMany({ include: { extensions: true, _count: { select: { orders: true } } }, orderBy: { opensAt: "desc" } }),
    db.employee.findMany({ distinct: ["department"], select: { department: true }, orderBy: { department: "asc" } }),
  ]);
  const round = view?.round;
  const [total, registered, ordered] = round
    ? await Promise.all([
        db.employee.count({ where: { active: true } }),
        db.employee.count({ where: { active: true, registeredAt: { not: null } } }),
        db.order.count({ where: { roundId: round.id } }),
      ])
    : [0, 0, 0];
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  const now = new Date();
  const next = rounds[0] ? { year: rounds[0].year, roundNumber: rounds[0].roundNumber + 1 } : { year: now.getFullYear(), roundNumber: 1 };

  return (
    <div className="max-w-5xl space-y-4">
      <h1 className="text-xl font-bold">รอบสั่งซื้อ</h1>
      {reminded && <p className="rounded-lg bg-ok-50 px-3 py-2 text-sm text-ok">ส่งแจ้งเตือนถึงพนักงานที่ยังไม่สั่ง {reminded} คนแล้ว</p>}

      {round && view && (
        <>
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold">{roundLabel(round)}</h2>
                  <Badge tone={view.phase === "OPEN" ? "ok" : view.phase === "UPCOMING" ? "navy" : "gray"}>
                    {view.phase === "OPEN" ? "● เปิดรับ" : view.phase === "UPCOMING" ? "ยังไม่เปิด" : "ปิดรับแล้ว"}
                  </Badge>
                </div>
                <p className="text-sm text-muted">พนักงานเห็นวันปิดรับนี้ในหน้าแรกและหน้าเข้าสู่ระบบ</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a href="#extend" className="rounded-lg border border-navy/40 px-3 py-2 text-sm font-semibold text-navy">
                  ขยายเวลา
                </a>
                <form action={remindNotOrdered}>
                  <input type="hidden" name="id" value={round.id} />
                  <SubmitButton variant="secondary" className="h-9">
                    ส่งแจ้งเตือนผู้ที่ยังไม่สั่ง
                  </SubmitButton>
                </form>
                {view.phase === "OPEN" && (
                  <form action={closeRoundNow}>
                    <input type="hidden" name="id" value={round.id} />
                    <SubmitButton variant="danger" className="h-9">
                      ปิดรอบตอนนี้
                    </SubmitButton>
                  </form>
                )}
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
                  <Label>ค่าส่งที่บ้าน (บาท)</Label>
                  <Input type="number" name="homeDeliveryFee" defaultValue={round.homeDeliveryFee} min={0} />
                </div>
                <div>
                  <Label>ส่งถึงสาขาภายใน (วันหลังปิดรอบ)</Label>
                  <Input type="number" name="deliveryDays" defaultValue={round.deliveryDays} min={1} />
                </div>
              </div>
            </ActionForm>

            <div className="mt-4">
              <div className="flex justify-between text-sm">
                <span className="font-semibold">ความคืบหน้า</span>
                <span className="text-muted">
                  สั่งแล้ว {ordered} จาก {total} คน · {Math.round(pct(ordered))}%
                </span>
              </div>
              <div className="mt-1.5 flex h-2.5 overflow-hidden rounded-full bg-gray-100">
                <div className="bg-ok" style={{ width: `${pct(ordered)}%` }} />
                <div className="bg-accent/70" style={{ width: `${pct(registered - ordered)}%` }} />
              </div>
              <div className="mt-1.5 flex gap-4 text-xs text-muted">
                <span><span className="text-ok">●</span> สั่งแล้ว {ordered}</span>
                <span><span className="text-accent">●</span> ลงทะเบียนแล้ว ยังไม่สั่ง {Math.max(0, registered - ordered)}</span>
                <span><span className="text-gray-300">●</span> ยังไม่ลงทะเบียน {total - registered}</span>
              </div>
            </div>
          </Card>

          <Card id="extend" className="border-navy/40 p-4">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-bold">ขยายเวลาปิดรับ</h2>
                <p className="text-sm text-muted">ใช้เมื่อต้องปรับไทม์ไลน์การสั่งซื้อประจำปี ระบบจะคำนวณวันจัดส่งใหม่ให้อัตโนมัติ</p>
              </div>
              <Badge tone="accent">ขยายแล้ว {round.extensions.length} ครั้ง</Badge>
            </div>
            <ExtendForm
              roundId={round.id}
              currentClose={(round.closedEarlyAt ?? round.closesAt).toISOString()}
              originalClose={round.originalClosesAt.toISOString()}
              opensAt={round.opensAt.toISOString()}
              deliveryDays={round.deliveryDays}
              departments={departments.map((d) => d.department)}
            />
            {round.extensions.length > 0 && (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-1 text-sm font-semibold">ประวัติการขยายเวลา</p>
                <ul className="space-y-1 text-sm text-muted">
                  {round.extensions.map((e) => (
                    <li key={e.id}>
                      {thDateTime(e.createdAt)} · {e.createdBy}: {thDateTime(e.previousClosesAt)} → <b className="text-ink">{thDateTime(e.newClosesAt)}</b> ·{" "}
                      {e.scope === "ALL" ? "ทุกคน" : `แผนก${e.department}`} · {e.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Card>
        </>
      )}

      <Card className="p-4">
        <h2 className="font-bold">ไทม์ไลน์มาตรฐานของรอบ</h2>
        <p className="text-sm text-muted">ค่าเริ่มต้นเมื่อสร้างรอบใหม่</p>
        <ActionForm action={saveTimelineSettings} submit="บันทึก" variant="secondary" className="mt-3">
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>เปิดรับคำสั่งซื้อ (วัน)</Label>
              <Input type="number" name="openDays" defaultValue={settings.openDays} min={1} />
            </div>
            <div>
              <Label>จัดส่งถึงสาขาภายใน (วันหลังปิดรอบ)</Label>
              <Input type="number" name="deliveryDays" defaultValue={settings.deliveryDays} min={1} />
            </div>
            <div>
              <Label>ค่าส่งที่บ้าน (บาท)</Label>
              <Input type="number" name="homeDeliveryFee" defaultValue={settings.homeDeliveryFee} min={0} />
            </div>
          </div>
        </ActionForm>
      </Card>

      <Card className="p-4">
        <h2 className="font-bold">สร้างรอบใหม่</h2>
        <ActionForm action={createRound} submit="+ สร้างรอบใหม่" className="mt-3">
          <input type="hidden" name="openDays" value={settings.openDays} />
          <input type="hidden" name="deliveryDays" value={settings.deliveryDays} />
          <input type="hidden" name="homeDeliveryFee" value={settings.homeDeliveryFee} />
          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <Label>ปี</Label>
              <Input type="number" name="year" defaultValue={next.year} />
            </div>
            <div>
              <Label>รอบที่</Label>
              <Input type="number" name="roundNumber" defaultValue={next.roundNumber} />
            </div>
            <div>
              <Label>วันเปิดรับ</Label>
              <Input type="datetime-local" name="opensAt" required />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">
            ปิดรับอัตโนมัติ 23:59 ของวันที่ {settings.openDays} · ส่งถึงสาขาภายใน {settings.deliveryDays} วันหลังปิดรอบ
          </p>
        </ActionForm>
      </Card>

      <Card className="overflow-x-auto">
        <h2 className="px-4 pt-4 font-bold">รอบทั้งหมด</h2>
        <table className="mt-2 w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-xs text-muted">
            <tr>
              <th className="px-4 py-2 font-medium">รอบ</th>
              <th className="px-4 py-2 font-medium">ช่วงเวลา</th>
              <th className="px-4 py-2 font-medium">คำสั่งซื้อ</th>
              <th className="px-4 py-2 font-medium">สถานะ</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rounds.map((r) => {
              const close = effectiveCloseAt(r, r.extensions);
              const phase = roundPhase(r, close);
              return (
                <tr key={r.id} className="border-t border-line">
                  <td className="px-4 py-2 font-semibold">{roundLabel(r)}</td>
                  <td className="px-4 py-2">
                    {thDate(r.opensAt)} – {thDate(close)}
                    <span className="block text-xs text-muted">ส่งภายใน {thDate(deliveryDueAt(close, r.deliveryDays))}</span>
                  </td>
                  <td className="px-4 py-2">{r._count.orders.toLocaleString("th-TH")}</td>
                  <td className="px-4 py-2">
                    <Badge tone={phase === "OPEN" ? "ok" : phase === "UPCOMING" ? "navy" : "gray"}>
                      {phase === "OPEN" ? "เปิดรับ" : phase === "UPCOMING" ? "ยังไม่เปิด" : "ปิดรับแล้ว"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <a href={`/admin/export/orders?round=${r.id}`} className="font-semibold text-navy">
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
