"use client";

import Link from "next/link";
import { Badge, Card } from "@/components/ui";
import { FormMessage, SubmitButton, useFormAction } from "@/components/forms";
import { baht } from "@/lib/format";
import { placeWelfareOrder } from "../actions";
import { PaymentPicker, Row } from "./parts";

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
  mode: "FIXED" | "CREDIT";
  credit: number;
  roundName: string;
  closeAtText: string;
  deliveryDays: number;
  workLocation: string | null;
  workAddress: string | null;
  amountPaid: number;
  isEdit: boolean;
  totals: { subtotal: number; creditUsed: number; total: number };
  lines: Line[];
}) {
  const { state, onSubmit, pending } = useFormAction(placeWelfareOrder);
  const credit = props.mode === "CREDIT";
  const due = props.totals.total - props.amountPaid;
  const pieces = props.lines.reduce((s, l) => s + l.quantity, 0);
  const freePieces = props.lines.reduce((s, l) => s + l.entitledQty, 0);

  return (
    <form onSubmit={onSubmit} className="space-y-3 px-4 py-4 pb-36">
      <div className="rounded-lg bg-white px-3 py-2.5 text-sm">
        หลังยืนยันแล้ว แก้ไขไซส์หรือความยาวได้ถึง <b>{props.closeAtText} น.</b>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
          <p className="font-medium">ในตะกร้า ({pieces} ชิ้น)</p>
          {credit && props.totals.total > 0 ? (
            <span className="text-xs font-medium text-bad">เกินเครดิต {baht(props.totals.total)}</span>
          ) : (
            <Link href="/" className="text-xs font-medium text-navy">
              + เพิ่มรายการ
            </Link>
          )}
        </div>
        {props.lines.map((l) => (
          <div key={l.productId} className="flex gap-3 border-b border-line px-3 py-2.5 last:border-0">
            <div className="h-12 w-12 shrink-0 rounded-md bg-sand" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{l.name}</p>
              <p className="text-xs text-muted">
                {l.size}
                {l.length ? ` · ${l.length}` : ""} · {l.quantity} ตัว
              </p>
              {!credit && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {l.entitledQty > 0 && <Badge tone="ok">ตามสิทธิ์ {l.entitledQty}</Badge>}
                  {l.extraQty > 0 && (
                    <Badge tone="accent">
                      ซื้อเพิ่ม {l.extraQty} · {baht(l.lineTotal)}
                    </Badge>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-col items-end justify-center gap-1">
              {credit && <span className="text-sm">{baht(l.lineTotal)}</span>}
              <Link href={`/items/${l.productId}?next=checkout`} className="text-sm font-medium text-navy">
                แก้ไข
              </Link>
            </div>
          </div>
        ))}
      </Card>

      <Card className="space-y-1 p-3 text-sm">
        <div className="flex items-center justify-between">
          <p className="font-medium">จัดส่งถึงที่ทำงาน</p>
          <Badge tone="ok">ฟรี</Badge>
        </div>
        <p>{props.workLocation ?? "ยังไม่มีข้อมูลสถานที่ทำงาน"}</p>
        {props.workAddress && <p className="text-xs text-muted">{props.workAddress}</p>}
        <p className="text-xs text-muted">ส่งถึงภายใน {props.deliveryDays} วันหลังปิดรอบ · แจ้งเลขพัสดุเมื่อจัดส่ง</p>
        <p className="text-xs text-muted">ที่อยู่ไม่ถูกต้อง? ติดต่อ HR เพื่ออัปเดต Work Location</p>
      </Card>

      <Card className="space-y-1.5 p-3 text-sm">
        <p className="mb-1 font-medium">สรุปค่าใช้จ่าย</p>
        {credit ? (
          <>
            <Row label={`ราคาสินค้ารวม ${pieces} ชิ้น`} value={baht(props.totals.subtotal)} />
            <Row label={`หักเครดิต ${props.roundName}`} value={`−${baht(props.totals.creditUsed)}`} tone="ok" />
          </>
        ) : (
          <>
            <Row label={`ตามสิทธิ์ ${freePieces} ชิ้น`} value={baht(0)} />
            {props.lines
              .filter((l) => l.extraQty > 0)
              .map((l) => (
                <Row key={l.productId} label={`ซื้อเพิ่ม: ${l.name} ${l.extraQty} ตัว`} value={baht(l.lineTotal)} />
              ))}
          </>
        )}
        {props.amountPaid > 0 && <Row label="ชำระไปแล้ว" value={`−${baht(props.amountPaid)}`} />}
        <div className="flex justify-between border-t border-line pt-2 font-medium">
          <span>{due < 0 ? "ส่วนต่างที่จะได้คืน" : credit ? "ส่วนเกินที่ต้องชำระ" : "ยอดชำระ"}</span>
          <span>{baht(Math.abs(due))}</span>
        </div>
        {credit && <p className="text-xs text-muted">เครดิตที่ไม่ได้ใช้จะไม่สะสมไปรอบถัดไป</p>}
      </Card>

      {due > 0 && <PaymentPicker title={credit ? "ชำระส่วนเกินด้วย" : "ชำระเงินด้วย"} />}

      <div className="fixed inset-x-0 bottom-16 z-10 mx-auto max-w-md space-y-2 border-t border-line bg-white px-4 py-2.5">
        <FormMessage state={state} />
        <p className="text-center text-xs text-muted">กดยืนยันแล้วระบบจะส่งยืนยันทาง SMS และอีเมล · แก้ไขได้จนถึงวันปิดรับ</p>
        <SubmitButton pending={pending} className="w-full">
          {due > 0 ? `ชำระ ${baht(due)} และยืนยันคำสั่งซื้อ` : props.isEdit ? "บันทึกการแก้ไข" : "ยืนยันคำสั่งซื้อ"}
        </SubmitButton>
      </div>
    </form>
  );
}
