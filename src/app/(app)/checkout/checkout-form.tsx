"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Card, Select, Textarea, cx } from "@/components/ui";
import { FormMessage, SubmitButton, useFormAction } from "@/components/forms";
import { baht } from "@/lib/format";
import { placeOrder } from "../actions";

type Line = {
  productId: string;
  name: string;
  size: string;
  length: string | null;
  quantity: number;
  entitledQty: number;
  extraQty: number;
  lineTotal: number;
};

export function CheckoutForm(props: {
  closeAtText: string;
  deliveryDays: number;
  homeDeliveryFee: number;
  amountPaid: number;
  isEdit: boolean;
  lines: Line[];
  branches: { id: string; label: string }[];
  defaults: { deliveryMethod: "BRANCH" | "HOME"; branchId: string; homeAddress: string };
}) {
  const { state, onSubmit, pending: submitting } = useFormAction(placeOrder);
  const [method, setMethod] = useState(props.defaults.deliveryMethod);
  const [pay, setPay] = useState<"PROMPTPAY" | "CARD">("PROMPTPAY");

  const extras = props.lines.reduce((s, l) => s + l.lineTotal, 0);
  const freePieces = props.lines.reduce((s, l) => s + l.entitledQty, 0);
  const fee = method === "HOME" ? props.homeDeliveryFee : 0;
  const total = extras + fee;
  const due = total - props.amountPaid;

  return (
    <form onSubmit={onSubmit} className="space-y-3 px-4 py-4 pb-32">
      <div className="rounded-lg bg-navy-50 px-3 py-2.5 text-sm text-navy">
        หลังยืนยันแล้ว แก้ไขไซส์หรือความยาวได้จนถึง <b>{props.closeAtText} น.</b>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
          <p className="font-semibold">รายการ ({props.lines.length})</p>
          <Link href="/" className="text-xs font-semibold text-navy">
            + เพิ่มรายการ
          </Link>
        </div>
        {props.lines.map((l) => (
          <div key={l.productId} className="flex gap-3 border-b border-line px-3 py-2.5 last:border-0">
            <div className="h-12 w-12 shrink-0 rounded-md bg-[#e8edf5]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{l.name}</p>
              <p className="text-xs text-muted">
                {l.size}
                {l.length ? ` · ${l.length}` : ""} · {l.quantity} ตัว
              </p>
              <div className="mt-1 flex flex-wrap gap-1">
                {l.entitledQty > 0 && <Badge tone="ok">ตามสิทธิ์ {l.entitledQty}</Badge>}
                {l.extraQty > 0 && (
                  <Badge tone="accent">
                    ซื้อเพิ่ม {l.extraQty} · {baht(l.lineTotal)}
                  </Badge>
                )}
              </div>
            </div>
            <Link href={`/items/${l.productId}?next=checkout`} className="self-center text-sm font-semibold text-navy">
              แก้ไข
            </Link>
          </div>
        ))}
      </Card>

      <Card className="space-y-2 p-3">
        <p className="font-semibold">การจัดส่ง</p>
        <input type="hidden" name="deliveryMethod" value={method} />
        <Option
          active={method === "BRANCH"}
          onClick={() => setMethod("BRANCH")}
          title="รับที่สาขา"
          hint={`ส่งถึงสาขาที่เลือก ภายใน ${props.deliveryDays} วันหลังปิดรอบ`}
          right="ฟรี"
        />
        <Option
          active={method === "HOME"}
          onClick={() => setMethod("HOME")}
          title="ส่งที่บ้าน"
          hint="สำหรับคำสั่งซื้อส่วนตัว มีค่าส่งเพิ่ม"
          right={`+${baht(props.homeDeliveryFee)}`}
        />
        {method === "BRANCH" ? (
          <div>
            <p className="mb-1 text-sm font-semibold">สาขาที่รับ</p>
            <Select name="branchId" defaultValue={props.defaults.branchId} required>
              <option value="">เลือกสาขา</option>
              {props.branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </Select>
          </div>
        ) : (
          <div>
            <p className="mb-1 text-sm font-semibold">ที่อยู่สำหรับจัดส่ง</p>
            <Textarea name="homeAddress" defaultValue={props.defaults.homeAddress} required placeholder="บ้านเลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์ เบอร์โทร" />
          </div>
        )}
      </Card>

      <Card className="space-y-1.5 p-3 text-sm">
        <p className="mb-1 font-semibold">สรุปค่าใช้จ่าย</p>
        <Row label={`ตามสิทธิ์ ${freePieces} ชิ้น`} value={baht(0)} />
        {props.lines
          .filter((l) => l.extraQty > 0)
          .map((l) => (
            <Row key={l.productId} label={`ซื้อเพิ่ม: ${l.name} ${l.extraQty} ตัว`} value={baht(l.lineTotal)} />
          ))}
        <Row label="ค่าจัดส่ง" value={fee ? baht(fee) : "ฟรี (รับที่สาขา)"} />
        {props.amountPaid > 0 && <Row label="ชำระไปแล้ว" value={`−${baht(props.amountPaid)}`} />}
        <div className="flex justify-between border-t border-line pt-2 font-bold">
          <span>{due < 0 ? "ส่วนต่างที่จะได้คืน" : "ยอดชำระ"}</span>
          <span>{baht(Math.abs(due))}</span>
        </div>
      </Card>

      {due > 0 && (
        <Card className="space-y-2 p-3">
          <p className="font-semibold">วิธีชำระเงิน</p>
          <input type="hidden" name="paymentMethod" value={pay} />
          <Option active={pay === "PROMPTPAY"} onClick={() => setPay("PROMPTPAY")} title="PromptPay QR" />
          <Option active={pay === "CARD"} onClick={() => setPay("CARD")} title="บัตรเครดิต / เดบิต" />
        </Card>
      )}

      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md space-y-2 border-t border-line bg-white px-4 py-2.5">
        <FormMessage state={state} />
        <p className="text-center text-xs text-muted">
          {due > 0 ? "ชำระเงินแล้วระบบจะยืนยันคำสั่งซื้อทันที" : "ไม่มีค่าใช้จ่ายเพิ่ม"} · แก้ไขได้จนถึงวันปิดรับ
        </p>
        <SubmitButton pending={submitting} className="w-full">
          {due > 0 ? `ชำระเงิน ${baht(due)} และยืนยันคำสั่งซื้อ` : props.isEdit ? "บันทึกการแก้ไข" : "ยืนยันคำสั่งซื้อ"}
        </SubmitButton>
      </div>
    </form>
  );
}

function Option({
  active,
  onClick,
  title,
  hint,
  right,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  hint?: string;
  right?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left",
        active ? "border-navy bg-navy-50" : "border-line bg-white",
      )}
    >
      <span className={cx("grid h-4 w-4 shrink-0 place-items-center rounded-full border-2", active ? "border-navy" : "border-gray-300")}>
        {active && <span className="h-2 w-2 rounded-full bg-navy" />}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      {right && <span className="text-sm font-semibold">{right}</span>}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className="shrink-0">{value}</span>
    </div>
  );
}
