"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const items = [
  { href: "/", label: "สั่งซื้อ", icon: "M9 3h6l1 3h3v15H5V6h3l1-3Z", match: (p: string) => p === "/" || p.startsWith("/items") || p.startsWith("/shop") || p.startsWith("/checkout") || p.startsWith("/pay") },
  { href: "/orders", label: "ประวัติ", icon: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z", match: (p: string) => p.startsWith("/orders") },
  { href: "/account", label: "บัญชี", icon: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0", match: (p: string) => p.startsWith("/account") || p.startsWith("/notifications") },
];

export function BottomNav() {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto flex h-16 max-w-md border-t border-line bg-white">
      {items.map((it) => {
        const active = it.match(path);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={cx("flex flex-1 flex-col items-center justify-center gap-0.5 text-xs", active ? "font-semibold text-navy" : "text-muted")}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={it.icon} />
            </svg>
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
