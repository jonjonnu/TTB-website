"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, ProductImage, Textarea, cx } from "@/components/ui";
import { FormMessage, SubmitButton, useFormAction } from "@/components/forms";
import { baht } from "@/lib/format";
import { removeCartItem, saveCartItem } from "../../actions";

type Props = {
  kind: "WELFARE" | "PERSONAL";
  /** FIXED: free up to the entitlement · CREDIT: priced, paid from credit first · PERSONAL: full price */
  mode: "FIXED" | "CREDIT" | "PERSONAL";
  product: {
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
    price: number;
    sizes: string[];
    lengths: string[];
    creditAllowed: boolean;
  };
  entitled: number;
  creditLeft: number;
  initial: { size: string; length: string | null; quantity: number; note: string | null } | null;
  next?: string;
};

export function ItemForm({ kind, mode, product, entitled, creditLeft, initial, next }: Props) {
  const { state, onSubmit, pending } = useFormAction(saveCartItem);
  const [size, setSize] = useState(initial?.size ?? "");
  const [length, setLength] = useState(initial?.length ?? (product.lengths.includes("ปกติ") ? "ปกติ" : ""));
  const [qty, setQty] = useState(initial?.quantity ?? (mode === "FIXED" ? Math.max(1, entitled) : 1));

  const free = mode === "FIXED" ? Math.min(qty, entitled) : 0;
  const priced = qty - free;
  const lineTotal = priced * product.price;
  const creditUsed = mode === "CREDIT" ? Math.min(creditLeft, lineTotal) : 0;
  const pay = lineTotal - creditUsed;

  const submitLabel =
    kind === "PERSONAL"
      ? next === "cart"
        ? "บันทึกและกลับไปตะกร้า"
        : "เพิ่มลงตะกร้า"
      : next === "checkout"
        ? "บันทึกและกลับไปตรวจสอบ"
        : mode === "CREDIT"
          ? "เพิ่มลงตะกร้า"
          : "บันทึกและเลือกรายการถัดไป";

  return (
    <div className="pb-28">
      <ProductImage src={product.imageUrl} alt={product.name} className="aspect-[4/3] w-full" />
      <form onSubmit={onSubmit} id="item-form" className="space-y-5 bg-white px-4 py-4">
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="productId" value={product.id} />
        <input type="hidden" name="size" value={size} />
        <input type="hidden" name="length" value={length} />
        <input type="hidden" name="quantity" value={qty} />
        <input type="hidden" name="next" value={next ?? ""} />
        <div>
          <h2 className="text-lg font-medium">{product.name}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {mode === "FIXED" ? (
              <>
                <Badge>สิทธิ์ {entitled} ตัว</Badge>
                <Badge tone="gray">ตัวที่เพิ่ม {baht(product.price)} / ตัว</Badge>
              </>
            ) : (
              <>
                <span className="text-lg font-medium">{baht(product.price)}</span>
                <span className="text-xs text-muted">/ ตัว</span>
                {product.creditAllowed && mode === "CREDIT" && <Badge tone="gray">ใช้เครดิตได้</Badge>}
              </>
            )}
          </div>
          {product.description && <p className="mt-2 text-sm text-muted">{product.description}</p>}
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-medium">
              ไซส์ <span className="text-bad">*</span>
            </p>
            <Link href="/size-guide" className="text-xs font-medium text-navy">
              คู่มือไซส์
            </Link>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {product.sizes.map((s) => (
              <Choice key={s} active={size === s} onClick={() => setSize(s)} wide={s.length > 4}>
                {s}
              </Choice>
            ))}
          </div>
        </div>

        {product.lengths.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">
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
            <p className="text-sm font-medium">จำนวน</p>
            {mode === "FIXED" && <p className="text-xs text-muted">ฟรีตามสิทธิ์ {entitled} ตัว เกินจากนี้ชำระเพิ่ม</p>}
          </div>
          <div className="flex items-center rounded-lg border border-line">
            <button type="button" aria-label="ลด" className="h-10 w-10 text-lg" onClick={() => setQty((q) => Math.max(1, q - 1))}>
              −
            </button>
            <span className="w-8 text-center font-medium" data-testid="qty">
              {qty}
            </span>
            <button type="button" aria-label="เพิ่ม" className="h-10 w-10 text-lg" onClick={() => setQty((q) => Math.min(20, q + 1))}>
              +
            </button>
          </div>
        </div>

        <div className={cx("space-y-1 rounded-lg p-3 text-sm", pay > 0 ? "bg-accent-50" : "bg-cream")}>
          {mode === "FIXED" && (
            <>
              <Row label={`ตามสิทธิ์ ${free} ตัว`} value={baht(0)} />
              {priced > 0 && <Row label={`ซื้อเพิ่ม ${priced} ตัว`} value={`${baht(product.price)} × ${priced}`} bold />}
            </>
          )}
          {mode === "CREDIT" && (
            <>
              <Row label="ราคารวม" value={baht(lineTotal)} />
              <Row label="ใช้เครดิตที่เหลือ" value={`−${baht(creditUsed)}`} />
              <Row label={pay > 0 ? "เกินเครดิต ชำระเพิ่ม" : "ชำระเพิ่ม"} value={baht(pay)} bold />
            </>
          )}
          {mode === "PERSONAL" && <Row label={`รวม ${qty} ตัว`} value={baht(lineTotal)} bold />}
        </div>

        <div>
          <p className="mb-1.5 text-sm font-medium">
            หมายเหตุถึงช่าง <span className="font-normal text-muted">(ไม่บังคับ)</span>
          </p>
          <Textarea name="note" defaultValue={initial?.note ?? ""} placeholder="เช่น ขอแขนยาวขึ้นเล็กน้อย" maxLength={300} />
        </div>
        <FormMessage state={state} />
      </form>

      {initial && (
        <form action={removeCartItem} className="px-4 pt-2">
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="productId" value={product.id} />
          <input type="hidden" name="next" value={next ?? ""} />
          <button className="w-full py-2 text-sm font-medium text-bad">นำรายการนี้ออก</button>
        </form>
      )}

      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md border-t border-line bg-white px-4 py-2.5">
        <p className="mb-1.5 text-center text-xs text-muted">
          ที่เลือก:{" "}
          <b className="text-ink">
            {size ? `ไซส์ ${size}` : "ยังไม่เลือกไซส์"}
            {length ? ` · ${length}` : ""} · {qty} ตัว
          </b>
        </p>
        <SubmitButton form="item-form" pending={pending} className="w-full" disabled={!size || (product.lengths.length > 0 && !length)}>
          {submitLabel}
        </SubmitButton>
      </div>
    </div>
  );
}

function Choice({ active, onClick, children, wide }: { active: boolean; onClick: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "h-10 rounded-lg border text-sm",
        wide && "col-span-3",
        active ? "border-navy bg-navy text-white" : "border-line bg-white hover:border-navy/40",
      )}
    >
      {children}
    </button>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={cx("flex justify-between", bold && "font-medium")}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
