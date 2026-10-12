import { db } from "@/lib/db";
import { baht, thShortDate } from "@/lib/format";
import { Card, Select } from "@/components/ui";
import { eligibleWhere, selectedRound } from "../lib";

const REPORTS = [
  ["usage", "รายงานการใช้สิทธิ์"],
  ["extras", "รายงานการสั่งซื้อเพิ่มเติม"],
  ["department", "รายงานแยกหน่วยงาน"],
  ["location", "รายงานแยกสาขา"],
  ["production", "รายงานการผลิต"],
  ["shipping", "รายงานการจัดส่ง"],
  ["outstanding", "รายงานสินค้าตกค้าง"],
  ["stock", "รายงานสินค้าคงเหลือ"],
] as const;

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ round?: string }> }) {
  const { round: roundParam } = await searchParams;
  const { rounds, round, view } = await selectedRound(roundParam);
  if (!round || !view) return <p className="text-muted">ยังไม่มีรอบสั่งซื้อ สร้างได้ที่หน้า &ldquo;รอบสั่งซื้อและเครดิต&rdquo;</p>;

  const since = round.opensAt;
  const [eligible, used, byStatus, welfareExtras, personal, paid] = await Promise.all([
    db.employee.count({ where: eligibleWhere(round) }),
    db.order.count({ where: { roundId: round.id } }),
    db.order.groupBy({ by: ["status"], where: { roundId: round.id }, _count: true }),
    db.order.count({ where: { roundId: round.id, total: { gt: 0 } } }),
    db.order.count({ where: { kind: "PERSONAL", createdAt: { gte: since } } }),
    db.order.aggregate({ where: { OR: [{ roundId: round.id }, { kind: "PERSONAL", createdAt: { gte: since } }] }, _sum: { amountPaid: true } }),
  ]);
  const n = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;
  const waitingProduction = n("PLACED") + n("ROUND_CLOSED");
  const producing = n("PRODUCING");
  const produced = n("SHIPPING") + n("DELIVERED");
  const waitingShip = waitingProduction + producing;
  const pct = (x: number) => (used ? (x / used) * 100 : 0);

  return (
    <div className="max-w-6xl space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-medium">แดชบอร์ด</h1>
          <p className="text-sm text-muted">
            {round.name} · เปิดรับ {thShortDate(round.opensAt)}–{thShortDate(view.closeAt)}
          </p>
        </div>
        <form className="flex gap-2">
          <Select name="round" defaultValue={round.id} className="w-auto">
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <button className="rounded-lg bg-navy px-3 text-sm text-white">ดู</button>
        </form>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="ผู้มีสิทธิ์" value={eligible.toLocaleString("th-TH")} sub={round.type === "NEW_JOINERS" ? "พนักงานใหม่ที่เลือก" : "ทุกแผนกในรอบนี้"} />
        <Stat label="ใช้สิทธิ์แล้ว" value={used.toLocaleString("th-TH")} sub={`${eligible ? Math.round((used / eligible) * 100) : 0}%`} />
        <Stat label="ยังไม่ใช้สิทธิ์" value={(eligible - used).toLocaleString("th-TH")} sub="ส่งแจ้งเตือนได้จากหน้าพนักงาน" />
        <Stat label="สั่งซื้อเพิ่มเติม" value={(welfareExtras + personal).toLocaleString("th-TH")} sub="ส่วนเกินเครดิต + Personal" />
        <Stat label="ยอดชำระส่วนเกิน" value={baht(paid._sum.amountPaid ?? 0)} sub="QR / โมบายแบงก์กิ้ง / บัตร" />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="space-y-3 p-4">
          <h2 className="font-medium">สถานะการผลิต</h2>
          <Bar label="รอผลิต" value={waitingProduction} pct={pct(waitingProduction)} />
          <Bar label="อยู่ระหว่างผลิต" value={producing} pct={pct(producing)} />
          <Bar label="ผลิตเสร็จ" value={produced} pct={pct(produced)} dark />
        </Card>
        <Card className="space-y-3 p-4">
          <h2 className="font-medium">สถานะการจัดส่ง</h2>
          <Bar label="รอจัดส่ง" value={waitingShip} pct={pct(waitingShip)} />
          <Bar label="อยู่ระหว่างจัดส่ง" value={n("SHIPPING")} pct={pct(n("SHIPPING"))} />
          <Bar label="จัดส่งสำเร็จ" value={n("DELIVERED")} pct={pct(n("DELIVERED"))} ok />
          <p className="text-xs text-muted">อัปเดตเลขพัสดุทีละกลุ่มได้ในหน้าพนักงานและคำสั่งซื้อ (เชื่อม J&T API ภายหลัง)</p>
        </Card>
      </div>

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">รายงาน</h2>
          <span className="text-xs text-muted">ดาวน์โหลดเป็น CSV (เปิดใน Excel ได้)</span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {REPORTS.map(([key, label]) => (
            <a
              key={key}
              href={`/admin/reports/${key}?round=${round.id}`}
              className="flex items-center justify-between rounded-lg border border-line px-3 py-2.5 text-sm hover:bg-cream"
            >
              {label}
              <span aria-hidden>↓</span>
            </a>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-latin text-2xl font-medium">{value}</p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </Card>
  );
}

function Bar({ label, value, pct, dark, ok }: { label: string; value: number; pct: number; dark?: boolean; ok?: boolean }) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted">{value.toLocaleString("th-TH")}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-cream">
        <div className={`h-2 rounded-full ${ok ? "bg-ok" : dark ? "bg-navy" : "bg-sand"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
