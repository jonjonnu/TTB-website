"use client";

import Link from "next/link";
import { useState } from "react";
import { Card, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton, useFormAction } from "@/components/forms";
import { baht } from "@/lib/format";
import { placePersonalOrder } from "../../actions";
import { Option, PaymentPicker, Row } from "../../checkout/parts";

type Line = { productId: string; name: string; size: string; length: string | null; quantity: number; lineTotal: number };

export function PersonalCheckoutForm(props: { lines: Line[]; homeDeliveryFee: number; workLocation: string | null; homeAddress: string }) {
  const { state, onSubmit, pending } = useFormAction(placePersonalOrder);
  const [method, setMethod] = useState<"WORKPLACE" | "HOME">("WORKPLACE");
  const subtotal = props.lines.reduce((s, l) => s + l.lineTotal, 0);
  const fee = method === "HOME" ? props.homeDeliveryFee : 0;

  return (
    <form onSubmit={onSubmit} className="space-y-3 px-4 py-4 pb-36">
      <Card>
        <p className="border-b border-line px-3 py-2.5 font-medium">ในตะกร้า ({props.lines.length})</p>
        {props.lines.map((l) => (
          <div key={l.productId} className="flex gap-3 border-b border-line px-3 py-2.5 last:border-0">
            <div className="h-12 w-12 shrink-0 rounded-md bg-sand" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{l.name}</p>
              <p className="text-xs text-muted">
                {l.size}
                {l.length ? ` · ${l.length}` : ""} · {l.quantity} ตัว
              </p>
            </div>
            <div className="flex flex-col items-end justify-center gap-1">
              <span className="text-sm">{baht(l.lineTotal)}</span>
              <Link href={`/store/${l.productId}?next=cart`} className="text-sm font-medium text-navy">
                แก้ไข
              </Link>
            </div>
          </div>
        ))}
      </Card>

      <Card className="space-y-2 p-3">
        <p className="font-medium">การจัดส่ง</p>
        <input type="hidden" name="deliveryMethod" value={method} />
        <Option
          active={method === "WORKPLACE"}
          onClick={() => setMethod("WORKPLACE")}
          title="ส่งถึงที่ทำงาน"
          hint={props.workLocation ?? "สถานที่ทำงานตามข้อมูล HR"}
          right="ฟรี"
        />
        <Option active={method === "HOME"} onClick={() => setMethod("HOME")} title="ส่งถึงบ้าน" hint="มีค่าส่งเพิ่ม" right={`+${baht(props.homeDeliveryFee)}`} />
        {method === "HOME" && (
          <Textarea
            name="homeAddress"
            defaultValue={props.homeAddress}
            required
            placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์ เบอร์โทร"
          />
        )}
      </Card>

      <Card className="space-y-1.5 p-3 text-sm">
        <p className="mb-1 font-medium">สรุปค่าใช้จ่าย</p>
        <Row label="ราคาสินค้า" value={baht(subtotal)} />
        <Row label="ค่าจัดส่ง" value={fee ? baht(fee) : "ฟรี"} />
        <div className="flex justify-between border-t border-line pt-2 font-medium">
          <span>ยอดชำระ</span>
          <span>{baht(subtotal + fee)}</span>
        </div>
        <p className="text-xs text-muted">คำสั่งซื้อส่วนตัวชำระเต็มจำนวน ไม่ใช้สิทธิ์หรือเครดิตสวัสดิการ</p>
      </Card>

      <PaymentPicker title="ชำระเงินด้วย" />

      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md space-y-2 border-t border-line bg-white px-4 py-2.5">
        <FormMessage state={state} />
        <SubmitButton pending={pending} className="w-full">
          ชำระ {baht(subtotal + fee)} และสั่งซื้อ
        </SubmitButton>
      </div>
    </form>
  );
}
