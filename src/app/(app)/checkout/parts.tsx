"use client";

import { useState } from "react";
import { Card, cx } from "@/components/ui";
import { PAYMENT_METHODS } from "@/lib/portal-labels";

export function PaymentPicker({ title }: { title: string }) {
  const [pay, setPay] = useState<string>("PROMPTPAY");
  return (
    <Card className="space-y-2 p-3">
      <p className="font-medium">{title}</p>
      <input type="hidden" name="paymentMethod" value={pay} />
      {PAYMENT_METHODS.map((m) => (
        <Option key={m.value} active={pay === m.value} onClick={() => setPay(m.value)} title={m.label} />
      ))}
    </Card>
  );
}

export function Option({
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
      className={cx("flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left", active ? "border-navy bg-cream" : "border-line bg-white")}
    >
      <span className={cx("grid h-4 w-4 shrink-0 place-items-center rounded-full border-2", active ? "border-navy" : "border-gray-300")}>
        {active && <span className="h-2 w-2 rounded-full bg-navy" />}
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{title}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      {right && <span className="text-sm font-medium">{right}</span>}
    </button>
  );
}

export function Row({ label, value, tone }: { label: string; value: string; tone?: "ok" }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted">{label}</span>
      <span className={cx("shrink-0", tone === "ok" && "text-ok")}>{value}</span>
    </div>
  );
}
