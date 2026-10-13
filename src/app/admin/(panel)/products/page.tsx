import { db } from "@/lib/db";
import { baht } from "@/lib/format";
import { DEPARTMENTS } from "@/lib/portal-labels";
import { Badge, Card, Input, Label, Textarea, cx } from "@/components/ui";
import { saveProduct, toggleProductFlag } from "../../actions";
import { ActionForm } from "../form-bits";
import type { Product } from "@prisma/client";

export default async function ProductsPage() {
  const products = await db.product.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return (
    <div className="max-w-6xl space-y-4">
      <div>
        <h1 className="text-xl font-medium">สินค้า</h1>
        <p className="text-sm text-muted">
          สินค้าทุกชิ้นมีราคา · &ldquo;ใช้เครดิตได้&rdquo; = ซื้อด้วยเครดิตสวัสดิการได้ · &ldquo;ขายส่วนตัว&rdquo; = แสดงในร้านค้าให้ซื้อราคาเต็ม · ราคาตอนนี้เป็นราคาตัวอย่าง
        </p>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-cream text-left text-xs text-muted">
            <tr>
              <th className="px-3 py-2 font-normal">สินค้า</th>
              <th className="px-3 py-2 font-normal">หมวด</th>
              <th className="px-3 py-2 text-right font-normal">ราคา</th>
              <th className="px-3 py-2 font-normal">แผนก (เครดิต)</th>
              <th className="px-3 py-2 font-normal">ใช้เครดิตได้</th>
              <th className="px-3 py-2 font-normal">ขายส่วนตัว</th>
              <th className="px-3 py-2 text-right font-normal">สต็อก</th>
            </tr>
          </thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className={cx("border-t border-line", !p.active && "opacity-60")}>
                <td className="px-3 py-2">
                  <a href={`#p-${p.id}`} className="text-navy">
                    {p.name}
                  </a>
                  <span className="block text-xs text-muted">
                    {p.sku}
                    {!p.active && " · ปิดขาย"}
                  </span>
                </td>
                <td className="px-3 py-2">{p.category ?? "-"}</td>
                <td className="px-3 py-2 text-right">{baht(p.price)}</td>
                <td className="px-3 py-2 text-xs">{p.departments.length ? p.departments.join(", ") : "ทุกแผนก"}</td>
                <td className="px-3 py-2">
                  <Toggle id={p.id} flag="creditAllowed" on={p.creditAllowed} />
                </td>
                <td className="px-3 py-2">
                  <Toggle id={p.id} flag="personalSale" on={p.personalSale} />
                </td>
                <td className={cx("px-3 py-2 text-right", p.stock <= 10 && "text-bad")}>{p.stock.toLocaleString("th-TH")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {products.map((p) => (
        <Card key={p.id} id={`p-${p.id}`} className="scroll-mt-4 p-4">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="font-medium">แก้ไข {p.name}</span>
              <span className="text-xs text-muted">
                ไซส์ {p.sizes.join(", ")}
                {p.lengths.length ? ` · ความยาว ${p.lengths.join(", ")}` : ""}
              </span>
              {!p.active && <Badge tone="gray">ปิดขาย</Badge>}
            </summary>
            <ProductForm p={p} />
          </details>
        </Card>
      ))}
      <Card className="p-4">
        <h2 className="font-medium">เพิ่มสินค้า</h2>
        <ProductForm />
      </Card>
    </div>
  );
}

function Toggle({ id, flag, on }: { id: string; flag: "creditAllowed" | "personalSale"; on: boolean }) {
  return (
    <form action={toggleProductFlag}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="flag" value={flag} />
      <button
        aria-label={on ? "เปิดอยู่ กดเพื่อปิด" : "ปิดอยู่ กดเพื่อเปิด"}
        className={cx("relative h-5 w-9 rounded-full transition-colors", on ? "bg-navy" : "bg-sand")}
      >
        <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all", on ? "left-[18px]" : "left-0.5")} />
      </button>
    </form>
  );
}

function ProductForm({ p }: { p?: Product }) {
  return (
    <ActionForm action={saveProduct} submit={p ? "บันทึก" : "เพิ่มสินค้า"} className="mt-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-3 md:grid-cols-4">
        <div className="md:col-span-2">
          <Label>ชื่อสินค้า</Label>
          <Input name="name" defaultValue={p?.name} required />
        </div>
        <div>
          <Label>SKU</Label>
          <Input name="sku" defaultValue={p?.sku} required />
        </div>
        <div>
          <Label>หมวด</Label>
          <Input name="category" defaultValue={p?.category ?? ""} placeholder="เสื้อ, สูท, ชุดเดรส…" />
        </div>
        <div>
          <Label>ราคาต่อตัว (บาท)</Label>
          <Input type="number" name="price" defaultValue={p?.price ?? ""} min={1} required />
        </div>
        <div>
          <Label>สต็อก</Label>
          <Input type="number" name="stock" defaultValue={p?.stock ?? 0} min={0} />
        </div>
        <div>
          <Label>ไซส์ (คั่นด้วย ,)</Label>
          <Input name="sizes" defaultValue={p?.sizes.join(", ") ?? "XS, S, M, L, XL, 2XL"} />
        </div>
        <div>
          <Label>ความยาว (เว้นว่างถ้าไม่มี)</Label>
          <Input name="lengths" defaultValue={p?.lengths.join(", ") ?? ""} placeholder="สั้น, ปกติ, ยาว" />
        </div>
        <div className="md:col-span-2">
          <Label>รายละเอียด</Label>
          <Textarea name="description" defaultValue={p?.description ?? ""} rows={2} />
        </div>
        <div>
          <Label>ลิงก์รูปภาพ</Label>
          <Input name="imageUrl" defaultValue={p?.imageUrl ?? ""} placeholder="https://…" />
        </div>
        <div>
          <Label>ลำดับการแสดง</Label>
          <Input type="number" name="sortOrder" defaultValue={p?.sortOrder ?? 0} />
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <span className="text-muted">แผนกที่เห็นในแคตตาล็อกเครดิต (ไม่เลือก = ทุกแผนก):</span>
        {DEPARTMENTS.map((d) => (
          <label key={d} className="flex items-center gap-1.5">
            <input type="checkbox" name="departments" value={d} defaultChecked={p?.departments.includes(d)} className="h-4 w-4 accent-navy" />
            {d}
          </label>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-sm">
        <Check name="creditAllowed" label="ใช้เครดิตได้" on={p?.creditAllowed ?? true} />
        <Check name="personalSale" label="ขายส่วนตัวในร้านค้า" on={p?.personalSale ?? true} />
        <Check name="active" label="เปิดใช้งาน" on={p?.active ?? true} />
      </div>
    </ActionForm>
  );
}

function Check({ name, label, on }: { name: string; label: string; on: boolean }) {
  return (
    <label className="flex items-center gap-1.5">
      <input type="checkbox" name={name} defaultChecked={on} className="h-4 w-4 accent-navy" />
      {label}
    </label>
  );
}
