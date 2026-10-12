"use client";

import { useState } from "react";
import { Badge, ProductImage, Textarea, cx } from "@/components/ui";
import { FormMessage, SubmitButton, useFormAction } from "@/components/forms";
import { baht } from "@/lib/format";
import { removeCartItem, saveCartItem } from "../../actions";

type Props = {
  product: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    price: number;
    sizes: string[];
    lengths: string[];
  };
  entitled: number;
  initial: { size: string; length: string | null; quantity: number; note: string | null } | null;
  next?: string;
};

export function ItemForm({ product, entitled, initial, next }: Props) {
  const { state, onSubmit, pending: submitting } = useFormAction(saveCartItem);
  const [size, setSize] = useState(initial?.size ?? "");
  const [length, setLength] = useState(initial?.length ?? (product.lengths.includes("ปกติ") ? "ปกติ" : ""));
  const [qty, setQty] = useState(initial?.quantity ?? Math.max(1, entitled));
  const [showChart, setShowChart] = useState(false);
  const free = Math.min(qty, entitled);
  const extra = qty - free;

  return (
    <div className="pb-28">
      <ProductImage src={product.imageUrl} alt={product.name} className="aspect-[4/3] w-full" />
      <form onSubmit={onSubmit} id="item-form" className="space-y-5 bg-white px-4 py-4">
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="size" value={size} />
        <input type="hidden" name="length" value={length} />
        <input type="hidden" name="quantity" value={qty} />
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <h2 className="text-lg font-bold">{product.name}</h2>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {entitled > 0 ? <Badge>สิทธิ์ {entitled} ตัว</Badge> : <Badge tone="accent">นอกเหนือสิทธิ์</Badge>}
            <Badge tone="gray">ตัวที่เพิ่ม {baht(product.price)} / ตัว</Badge>
          </div>
          {product.description && <p className="mt-2 text-sm text-muted">{product.description}</p>}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">
              ไซส์ <span className="text-bad">*</span>
            </p>
            <button type="button" onClick={() => setShowChart((s) => !s)} className="text-xs font-semibold text-navy">
              ตารางไซส์
            </button>
          </div>
          {showChart && (
            <div className="mb-2 rounded-lg bg-gray-50 p-2 text-xs text-muted">
              ตารางไซส์จะแสดงที่นี่ (รอข้อมูลจาก Songsmai) หากไม่แน่ใจ เลือกไซส์ที่ใส่ประจำ แล้วแก้ไขได้จนถึงวันปิดรับ
            </div>
          )}
          <div className="grid grid-cols-6 gap-1.5">
            {product.sizes.map((s) => (
              <Choice key={s} active={size === s} onClick={() => setSize(s)}>
                {s}
              </Choice>
            ))}
          </div>
        </div>

        {product.lengths.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold">
              ความยาว <span className="text-bad">*</span>
            </p>
            <div className="grid grid-cols-3 gap-1.5">
              {product.lengths.map((l) => (
                <Choice key={l} active={length === l} onClick={() => setLength(l)}>
                  {l}
                </Choice>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">จำนวน</p>
            <p className="text-xs text-muted">
              {entitled > 0 ? `ฟรีตามสิทธิ์ ${entitled} ตัว เกินจากนี้ชำระเพิ่ม` : "ชำระเงินทุกตัว"}
            </p>
          </div>
          <div className="flex items-center rounded-lg border border-line">
            <button type="button" aria-label="ลด" className="h-10 w-10 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="w-8 text-center font-semibold">{qty}</span>
            <button type="button" aria-label="เพิ่ม" className="h-10 w-10 text-lg" onClick={() => setQty((q) => Math.min(20, q + 1))}>
              +
            </button>
          </div>
        </div>

        <div className={cx("space-y-1 rounded-lg p-3 text-sm", extra > 0 ? "bg-accent-50" : "bg-gray-50")}>
          {entitled > 0 && (
            <Row label={`ตามสิทธิ์ ${free} ตัว`} value={baht(0)} />
          )}
          {extra > 0 && <Row label={`ซื้อเพิ่ม ${extra} ตัว`} value={`${baht(product.price)} × ${extra}`} bold />}
          {extra > 0 && <p className="text-xs text-muted">ชำระเงินตอนยืนยันคำสั่งซื้อ (PromptPay หรือบัตร)</p>}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold">
            หมายเหตุถึงช่าง <span className="font-normal text-muted">(ไม่บังคับ)</span>
          </p>
          <Textarea name="note" defaultValue={initial?.note ?? ""} placeholder="เช่น ขอแขนยาวขึ้นเล็กน้อย" maxLength={300} />
        </div>
        <FormMessage state={state} />
      </form>

      {initial && (
        <form action={removeCartItem} className="px-4 pt-2">
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="next" value={next ?? ""} />
          <button className="w-full py-2 text-sm font-semibold text-bad">นำรายการนี้ออก</button>
        </form>
      )}

      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md border-t border-line bg-white px-4 py-2.5">
        <p className="mb-1.5 text-center text-xs text-muted">
          ที่เลือก: <b className="text-ink">{size ? `ไซส์ ${size}` : "ยังไม่เลือกไซส์"}{length ? ` · ${length}` : ""} · {qty} ตัว</b>
        </p>
        <SubmitButton pending={submitting} form="item-form" className="w-full" disabled={!size || (product.lengths.length > 0 && !length)}>
          {next === "checkout" ? "บันทึกและกลับไปตรวจสอบ" : "บันทึกและเลือกรายการถัดไป"}
        </SubmitButton>
      </div>
    </div>
  );
}

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "h-10 rounded-lg border text-sm font-medium",
        active ? "border-navy bg-navy text-white" : "border-line bg-white hover:border-navy/40",
      )}
    >
      {children}
    </button>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cx("flex justify-between", bold && "font-semibold")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
