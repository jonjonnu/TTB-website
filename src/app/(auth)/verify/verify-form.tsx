"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FormMessage, SubmitButton } from "@/components/forms";
import { resendCode, verifyCode } from "../actions";

export function VerifyForm(props: {
  otpId: string;
  purpose: "REGISTER" | "RESET_PASSWORD";
  channel: "SMS" | "EMAIL";
  destination: string;
  canSwitch: boolean;
  ttlMinutes: number;
  resendIn: number;
  testCode: string | null;
}) {
  const [state, action] = useActionState(verifyCode, undefined);
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const [seconds, setSeconds] = useState(props.resendIn);
  const [resendError, setResendError] = useState<string>();
  const [pending, start] = useTransition();
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  function setDigit(i: number, v: string) {
    const clean = v.replace(/\D/g, "");
    if (clean.length > 1) {
      // Pasted the whole code.
      const next = clean.slice(0, 6).split("");
      setDigits([...next, ...Array(6 - next.length).fill("")]);
      refs.current[Math.min(next.length, 5)]?.focus();
      return;
    }
    const next = [...digits];
    next[i] = clean;
    setDigits(next);
    if (clean && i < 5) refs.current[i + 1]?.focus();
  }

  function resend(channel: "SMS" | "EMAIL") {
    start(async () => {
      const res = await resendCode(props.otpId, channel);
      if (res.error) return setResendError(res.error);
      router.replace(`/verify?otp=${res.otpId}`);
    });
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <form action={action} className="flex flex-1 flex-col px-4 py-5">
      <input type="hidden" name="otpId" value={props.otpId} />
      <input type="hidden" name="code" value={digits.join("")} />
      <div className="grid h-11 w-11 place-items-center rounded-lg bg-navy-50 text-navy">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {props.channel === "SMS" ? (
            <>
              <rect x="7" y="2" width="10" height="20" rx="2" />
              <path d="M11 18h2" />
            </>
          ) : (
            <>
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 7 9 6 9-6" />
            </>
          )}
        </svg>
      </div>
      <h2 className="mt-4 text-xl font-medium">กรอกรหัส OTP</h2>
      <p className="mt-1 text-sm text-muted">
        เราส่งรหัส 6 หลักไปที่ <b className="text-ink">{props.destination}</b> แล้ว รหัสมีอายุ {props.ttlMinutes} นาที
      </p>

      <div className="mt-5 flex justify-between gap-2" dir="ltr">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            value={d}
            onChange={(e) => setDigit(i, e.target.value)}
            onKeyDown={(e) => e.key === "Backspace" && !d && i > 0 && refs.current[i - 1]?.focus()}
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            aria-label={`หลักที่ ${i + 1}`}
            className="h-14 w-full rounded-lg border border-line text-center text-xl font-medium outline-none focus:border-navy focus:ring-2 focus:ring-navy/15"
            autoFocus={i === 0}
          />
        ))}
      </div>

      <div className="mt-4 space-y-2 text-center text-sm">
        {seconds > 0 ? (
          <p className="text-muted">
            ไม่ได้รับรหัส? ส่งอีกครั้งได้ใน <b className="text-ink">{mm}:{ss}</b>
          </p>
        ) : (
          <button type="button" disabled={pending} onClick={() => resend(props.channel)} className="font-medium text-navy">
            ส่งรหัสอีกครั้ง
          </button>
        )}
        {props.canSwitch && (
          <button
            type="button"
            disabled={pending || seconds > 0}
            onClick={() => resend(props.channel === "SMS" ? "EMAIL" : "SMS")}
            className="block w-full font-medium text-navy disabled:opacity-40"
          >
            {props.channel === "SMS" ? "เปลี่ยนเป็นส่งทางอีเมล" : "เปลี่ยนเป็นส่งทาง SMS"}
          </button>
        )}
        {resendError && <p className="text-bad">{resendError}</p>}
        {props.testCode && (
          <p className="rounded-md bg-accent-50 px-2 py-1 text-xs text-accent">
            โหมดทดสอบ (ยังไม่ส่ง SMS/อีเมลจริง) · รหัสทดสอบ: <b>{props.testCode}</b>
          </p>
        )}
      </div>

      <div className="mt-auto space-y-3 pt-6">
        <FormMessage state={state} />
        <SubmitButton className="w-full" disabled={digits.join("").length !== 6}>
          {props.purpose === "REGISTER" ? "ยืนยันและสร้างบัญชี" : "ยืนยันและตั้งรหัสผ่านใหม่"}
        </SubmitButton>
      </div>
    </form>
  );
}
