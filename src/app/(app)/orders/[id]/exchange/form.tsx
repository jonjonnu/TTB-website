"use client";

import { useState } from "react";
import { Card, Label, Textarea } from "@/components/ui";
import { FormMessage, SubmitButton, useFormAction } from "@/components/forms";
import { EXCHANGE_REASONS } from "@/lib/portal-labels";
import { requestExchange } from "../../../actions";
import { Option } from "../../../checkout/parts";

export function ExchangeForm({ orderId, items }: { orderId: string; items: string[] }) {
  const { state, onSubmit, pending } = useFormAction(requestExchange);
  const [reason, setReason] = useState<string>("WRONG_SIZE");
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="reason" value={reason} />
      <Card className="space-y-2 p-3">
        <p className="font-medium">เหตุผล</p>
        {EXCHANGE_REASONS.map((r) => (
          <Option key={r.value} active={reason === r.value} onClick={() => setReason(r.value)} title={r.label} />
        ))}
      </Card>
      <Card className="p-3">
        <Label htmlFor="details">รายละเอียด</Label>
        <Textarea
          id="details"
          name="details"
          required
          placeholder={`เช่น ${items[0] ?? "เสื้อสูท (M)"} คับไป ขอเปลี่ยนเป็นไซส์ L`}
          className="min-h-28"
        />
      </Card>
      <FormMessage state={state} />
      <SubmitButton pending={pending} className="w-full">
        ส่งคำขอเปลี่ยนสินค้า
      </SubmitButton>
    </form>
  );
}
