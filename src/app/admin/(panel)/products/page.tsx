import { db } from "@/lib/db";
import { baht } from "@/lib/format";
import { Badge, Card, Input, Label, Textarea } from "@/components/ui";
import { saveProduct } from "../../actions";
import { ActionForm } from "../form-bits";
import type { Product } from "@prisma/client";

export default async function ProductsPage() {
  const products = await db.product.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });
  return (
    <div className="max-w-5xl space-y-4">
      <div>
        <h1 className="text-xl font-bold">สินค้า</h1>
        <p className="text-sm text-muted">ราคาเป็นราคาต่อตัวสำหรับส่วนที่เกินสิทธิ์ (ตอนนี้เป็นราคาตัวอย่าง)</p>
      </div>
      {products.map((p) => (
        <Card key={p.id} className="p-4">
          <details>
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="font-semibold">{p.name}</span>
              <span className="text-xs text-muted">{p.sku}</span>
              <span className="text-sm">{baht(p.price)}</span>
              <span className="text-xs text-muted">ไซส์ {p.sizes.join(", ")}{p.lengths.length ? ` · ความยาว ${p.lengths.join(", ")}` : ""}</span>
              {!p.active && <Badge tone="gray">ปิดขาย</Badge>}
            </summary>
            <ProductForm p={p} />
          </details>
        </Card>
      ))}
      <Card className="p-4">
        <h2 className="font-semibold">เพิ่มสินค้า</h2>
        <ProductForm />
      </Card>
    </div>
  );
}

function ProductForm({ p }: { p?: Product }) {
  return (
    <ActionForm action={saveProduct} submit={p ? "บันทึก" : "เพิ่มสินค้า"} className="mt-3">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <Label>ชื่อสินค้า</Label>
          <Input name="name" defaultValue={p?.name} required />
        </div>
        <div>
          <Label>SKU</Label>
          <Input name="sku" defaultValue={p?.sku} required />
        </div>
        <div>
          <Label>ราคาต่อตัว (บาท)</Label>
          <Input type="number" name="price" defaultValue={p?.price ?? 0} min={0} />
        </div>
        <div>
          <Label>ไซส์ (คั่นด้วย ,)</Label>
          <Input name="sizes" defaultValue={p?.sizes.join(", ") ?? "XS, S, M, L, XL, 2XL"} />
        </div>
        <div>
          <Label>ความยาว (คั่นด้วย , เว้นว่างถ้าไม่มี)</Label>
          <Input name="lengths" defaultValue={p?.lengths.join(", ") ?? ""} placeholder="สั้น, ปกติ, ยาว" />
        </div>
        <div>
          <Label>ลำดับการแสดง</Label>
          <Input type="number" name="sortOrder" defaultValue={p?.sortOrder ?? 0} />
        </div>
        <div className="md:col-span-2">
          <Label>รายละเอียด</Label>
          <Textarea name="description" defaultValue={p?.description ?? ""} />
        </div>
        <div>
          <Label>ลิงก์รูปภาพ</Label>
          <Input name="imageUrl" defaultValue={p?.imageUrl ?? ""} placeholder="https://…" />
          <label className="mt-2 flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="h-4 w-4 accent-navy" />
            เปิดขาย
          </label>
        </div>
      </div>
    </ActionForm>
  );
}
