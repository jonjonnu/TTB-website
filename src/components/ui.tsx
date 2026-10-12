import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "danger" | "ghost";

const variants: Record<Variant, string> = {
  primary: "bg-navy text-white hover:bg-navy-dark disabled:bg-navy/40",
  secondary: "bg-white text-navy border border-navy/30 hover:bg-navy-50",
  danger: "bg-white text-bad border border-bad/40 hover:bg-bad-50",
  ghost: "text-navy hover:bg-navy-50",
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg px-4 h-11 text-sm font-semibold transition-colors disabled:cursor-not-allowed";

export function Button({ variant = "primary", className, ...props }: ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={cx(base, variants[variant], className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant }) {
  return <Link className={cx(base, variants[variant], className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-xl bg-white border border-line", className)} {...props} />;
}

type Tone = "navy" | "ok" | "warn" | "bad" | "gray" | "accent";
const tones: Record<Tone, string> = {
  navy: "bg-navy-50 text-navy",
  ok: "bg-ok-50 text-ok",
  warn: "bg-warn-50 text-warn",
  bad: "bg-bad-50 text-bad",
  gray: "bg-gray-100 text-gray-600",
  accent: "bg-accent-50 text-accent",
};

export function Badge({ tone = "navy", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Label({ children, htmlFor, extra }: { children: ReactNode; htmlFor?: string; extra?: ReactNode }) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <label htmlFor={htmlFor} className="text-sm font-semibold">
        {children}
      </label>
      {extra}
    </div>
  );
}

const field =
  "w-full rounded-lg border border-line bg-white px-3 h-11 text-sm outline-none focus:border-navy focus:ring-2 focus:ring-navy/15 disabled:bg-gray-50 disabled:text-muted";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(field, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(field, className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(field, "h-auto py-2 min-h-20", className)} {...props} />;
}

export function Alert({ tone = "warn", children }: { tone?: "warn" | "bad" | "ok" | "navy"; children: ReactNode }) {
  const t = {
    warn: "bg-warn-50 border-warn/20 text-warn",
    bad: "bg-bad-50 border-bad/20 text-bad",
    ok: "bg-ok-50 border-ok/20 text-ok",
    navy: "bg-navy-50 border-navy/15 text-navy",
  }[tone];
  return <div className={cx("rounded-lg border px-3 py-2.5 text-sm", t)}>{children}</div>;
}

export function TopBar({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-line bg-white px-3">
      {back && (
        <Link href={back} aria-label="ย้อนกลับ" className="grid h-9 w-9 place-items-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      )}
      <h1 className="flex-1 text-base font-semibold">{title}</h1>
      {right}
    </header>
  );
}

export function Logo({ light }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className={cx("rounded-md px-1.5 py-0.5 text-xs font-bold", light ? "bg-white text-navy" : "bg-navy text-white")}>
        TTB
      </span>
      <span className={cx("text-sm font-semibold", light ? "text-white" : "text-ink")}>Uniform</span>
    </span>
  );
}

export function ProductImage({ src, alt, className }: { src?: string | null; alt: string; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} className={cx("bg-navy-50 object-cover", className)} />;
  }
  return (
    <div className={cx("grid place-items-center bg-[#e8edf5] text-[#9aa8bf]", className)} aria-label={alt}>
      <div className="flex flex-col items-center gap-1">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M12 6a2 2 0 1 1 2 2c-1 0-2 .5-2 1.5V10m0 0 9 6.5a1 1 0 0 1-.6 1.8H3.6a1 1 0 0 1-.6-1.8L12 10Z" />
        </svg>
        <span className="text-[10px]">(ภาพสินค้า)</span>
      </div>
    </div>
  );
}

export function Stepper({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex items-center gap-2 px-4 pt-3">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={cx("h-1 flex-1 rounded-full", i < step ? "bg-navy" : "bg-navy-100")} />
      ))}
      <span className="ml-1 shrink-0 text-xs text-muted">
        ขั้นตอน {step} จาก {total}
      </span>
    </div>
  );
}
