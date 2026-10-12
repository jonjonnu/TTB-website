import { db } from "@/lib/db";
import { Card, Input, Label, Select } from "@/components/ui";
import { addRule, deleteRule } from "../../actions";
import { ActionForm } from "../form-bits";

export default async function EntitlementsPage() {
  const [rules, products, departments, positions] = await Promise.all([
    db.entitlementRule.findMany({ include: { product: true }, orderBy: [{ product: { sortOrder: "asc" } }, { createdAt: "asc" }] }),
    db.product.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } }),
    db.employee.findMany({ distinct: ["department"], select: { department: true }, orderBy: { department: "asc" } }),
    db.employee.findMany({ distinct: ["position"], select: { position: true }, orderBy: { position: "asc" } }),
  ]);

  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">สิทธิ์เครื่องแบบ</h1>
        <p className="text-sm text-muted">
          กำหนดว่าพนักงานกลุ่มไหนได้รับเครื่องแบบอะไร กี่ตัวต่อรอบ (ฟรี) ช่องที่เว้นว่างหมายถึง &ldquo;ทุกคน&rdquo; ถ้าตรงหลายกฎ ระบบใช้จำนวนที่มากที่สุด
        </p>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-gray-50 text-left text-xs text-muted">
            <tr>
              {["เครื่องแบบ", "เพศ", "แผนก", "ตำแหน่ง", "จำนวน/รอบ", ""].map((h, i) => (
                <th key={i} className="px-3 py-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="px-3 py-2 font-medium">{r.product.name}</td>
                <td className="px-3 py-2">{r.gender === "FEMALE" ? "หญิง" : r.gender === "MALE" ? "ชาย" : "ทุกเพศ"}</td>
                <td className="px-3 py-2">{r.department ?? "ทุกแผนก"}</td>
                <td className="px-3 py-2">{r.position ?? "ทุกตำแหน่ง"}</td>
                <td className="px-3 py-2">{r.quantity}</td>
                <td className="px-3 py-2 text-right">
                  <form action={deleteRule}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="text-xs text-bad">ลบ</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card className="p-4">
        <h2 className="font-semibold">เพิ่มกฎ</h2>
        <ActionForm action={addRule} submit="เพิ่มกฎ" className="mt-3">
          <div className="grid gap-3 md:grid-cols-5">
            <div>
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
              <Label>เพศ</Label>
              <Select name="gender">
                <option value="">ทุกเพศ</option>
                <option value="FEMALE">หญิง</option>
                <option value="MALE">ชาย</option>
              </Select>
            </div>
            <div>
              <Label>แผนก</Label>
              <Select name="department">
                <option value="">ทุกแผนก</option>
                {departments.map((d) => (
                  <option key={d.department}>{d.department}</option>
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
              <Label>จำนวน/รอบ</Label>
              <Input type="number" name="quantity" min={1} defaultValue={1} />
            </div>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
