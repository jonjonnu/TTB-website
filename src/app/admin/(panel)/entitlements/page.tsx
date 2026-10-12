import { db } from "@/lib/db";
import { DEPARTMENTS } from "@/lib/portal-labels";
import { Card, Input, Label, Select } from "@/components/ui";
import { addRule, deleteRule, updateRuleQuantity } from "../../actions";
import { ActionForm } from "../form-bits";

export default async function EntitlementsPage() {
  const [rules, products, positions] = await Promise.all([
    db.entitlementRule.findMany({
      include: { product: true },
      orderBy: [{ department: "asc" }, { position: "asc" }, { minYears: "asc" }, { product: { sortOrder: "asc" } }],
    }),
    db.product.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.employee.findMany({ distinct: ["position"], select: { position: true }, orderBy: { position: "asc" } }),
  ]);

  // Group rules by who they apply to, so HR reads "Branch · Teller · 5+ ปี → …".
  const groups = new Map<string, typeof rules>();
  for (const r of rules) {
    const key = [
      r.department ?? "ทุกแผนก",
      r.position ?? "ทุกตำแหน่ง",
      r.gender === "FEMALE" ? "หญิง" : r.gender === "MALE" ? "ชาย" : "ทุกเพศ",
      r.minYears ? `อายุงาน ${r.minYears} ปีขึ้นไป` : "ทุกอายุงาน",
    ].join(" · ");
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-medium">สิทธิ์เครื่องแบบ</h1>
        <p className="text-sm text-muted">
          ใช้กับแผนกที่รับแบบ &ldquo;ตามสิทธิ์&rdquo; (Branch, Wealth) · กำหนดว่าใครได้อะไร กี่ตัวต่อรอบ ตามตำแหน่งและอายุงาน · ถ้าตรงหลายกฎ ระบบใช้จำนวนที่มากที่สุด
        </p>
      </div>

      {[...groups].map(([who, list]) => (
        <Card key={who} className="overflow-hidden">
          <p className="bg-cream px-4 py-2 text-sm font-medium">{who}</p>
          <ul>
            {list.map((r) => (
              <li key={r.id} className="flex items-center gap-3 border-t border-line px-4 py-2 text-sm">
                <span className="flex-1">{r.product.name}</span>
                <form action={updateRuleQuantity} className="flex items-center gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <Input type="number" name="quantity" min={0} defaultValue={r.quantity} className="h-9 w-20" aria-label="จำนวนต่อรอบ" />
                  <span className="text-xs text-muted">ตัว/รอบ</span>
                  <button className="text-xs text-navy">บันทึก</button>
                </form>
                <form action={deleteRule}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className="text-xs text-bad">ลบ</button>
                </form>
              </li>
            ))}
          </ul>
        </Card>
      ))}
      {groups.size === 0 && <Card className="p-4 text-sm text-muted">ยังไม่มีกฎสิทธิ์</Card>}

      <Card className="p-4">
        <h2 className="font-medium">เพิ่มกฎ</h2>
        <p className="text-xs text-muted">ช่องที่เว้นว่างหมายถึงทุกคน</p>
        <ActionForm action={addRule} submit="เพิ่มกฎ" className="mt-3">
          <div className="grid gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <Label>เครื่องแบบ</Label>
              <Select name="productId" required>
                <option value="">เลือก</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>แผนก</Label>
              <Select name="department">
                <option value="">ทุกแผนก</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>ตำแหน่ง</Label>
              <Select name="position">
                <option value="">ทุกตำแหน่ง</option>
                {positions.map((d) => (
                  <option key={d.position}>{d.position}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label>เพศ</Label>
              <Select name="gender">
                <option value="">ทุกเพศ</option>
                <option value="FEMALE">หญิง</option>
                <option value="MALE">ชาย</option>
              </Select>
            </div>
            <div>
              <Label>อายุงานขั้นต่ำ (ปี)</Label>
              <Input type="number" name="minYears" min={0} placeholder="ทุกอายุงาน" />
            </div>
            <div>
              <Label>จำนวน/รอบ</Label>
              <Input type="number" name="quantity" min={1} defaultValue={1} />
            </div>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
