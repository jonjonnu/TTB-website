"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { FormMessage, SubmitButton, useFormAction } from "@/components/forms";
import { Button, Input, Label } from "@/components/ui";
import { payWithOmise } from "../../actions";

type OmiseJs = {
  setPublicKey(key: string): void;
  createToken(
    type: "card",
    card: { name: string; number: string; expiration_month: string; expiration_year: string; security_code: string },
    cb: (status: number, res: { id?: string; message?: string }) => void,
  ): void;
};
declare global {
  interface Window {
    Omise?: OmiseJs;
  }
}

/** Re-checks the payment every few seconds while the PromptPay QR is on screen. */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds]);
  return null;
}

export function BankPicker({ paymentId, banks }: { paymentId: string; banks: readonly { type: string; label: string }[] }) {
  const { state, onSubmit, pending } = useFormAction(payWithOmise);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <p className="font-medium">เลือกแอปธนาคาร</p>
      {banks.map((b) => (
        <Button key={b.type} type="submit" name="bank" value={b.type} variant="secondary" className="w-full justify-start" disabled={pending}>
          {b.label}
        </Button>
      ))}
      <FormMessage state={state} />
    </form>
  );
}

export function NewQrButton({ paymentId }: { paymentId: string }) {
  const { state, onSubmit, pending } = useFormAction(payWithOmise);
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <input type="hidden" name="paymentId" value={paymentId} />
      <SubmitButton className="w-full" pending={pending}>
        สร้าง QR ใหม่
      </SubmitButton>
      <FormMessage state={state} />
    </form>
  );
}

/** Card details go straight from the browser to Omise; the server only receives a one-time token. */
export function CardForm({ paymentId, publicKey }: { paymentId: string; publicKey: string }) {
  const { state, onSubmit, pending } = useFormAction(payWithOmise);
  const [error, setError] = useState<string>();
  const [tokenizing, setTokenizing] = useState(false);
  const token = useRef<HTMLInputElement>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    if (token.current?.value) return onSubmit(e);
    e.preventDefault();
    const form = e.currentTarget;
    // Card fields have no name attribute, so they are never sent to our server.
    const field = (id: string) => (form.querySelector(`#${id}`) as HTMLInputElement).value.trim();
    const [mm, yy] = field("expiry").split("/").map((s) => s.trim());
    if (!window.Omise) return setError("กำลังโหลดระบบชำระเงิน กรุณาลองอีกครั้ง");
    setError(undefined);
    setTokenizing(true);
    window.Omise.setPublicKey(publicKey);
    window.Omise.createToken(
      "card",
      {
        name: field("card-name"),
        number: field("card-number").replace(/\s/g, ""),
        expiration_month: mm ?? "",
        expiration_year: yy && yy.length === 2 ? `20${yy}` : (yy ?? ""),
        security_code: field("card-cvc"),
      },
      (status, res) => {
        setTokenizing(false);
        if (status !== 200 || !res.id) return setError(res.message ?? "ข้อมูลบัตรไม่ถูกต้อง");
        token.current!.value = res.id;
        form.requestSubmit();
        token.current!.value = "";
      },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <Script src="https://cdn.omise.co/omise.js" strategy="afterInteractive" />
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="cardToken" ref={token} />
      <div>
        <Label htmlFor="card-name">ชื่อบนบัตร</Label>
        <Input id="card-name" autoComplete="cc-name" required />
      </div>
      <div>
        <Label htmlFor="card-number">หมายเลขบัตร</Label>
        <Input id="card-number" inputMode="numeric" autoComplete="cc-number" required />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="expiry">หมดอายุ</Label>
          <Input id="expiry" placeholder="MM/YY" autoComplete="cc-exp" required />
        </div>
        <div>
          <Label htmlFor="card-cvc">CVV</Label>
          <Input id="card-cvc" inputMode="numeric" autoComplete="cc-csc" required />
        </div>
      </div>
      <SubmitButton className="w-full" pending={pending || tokenizing}>
        ชำระเงิน
      </SubmitButton>
      <FormMessage state={error ? { error } : state} />
      <p className="text-center text-xs text-muted">ข้อมูลบัตรส่งตรงถึง Omise ไม่ถูกเก็บในระบบนี้</p>
    </form>
  );
}
