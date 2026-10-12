"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const links = [
  { href: "/admin", label: "พนักงานและสถานะ" },
  { href: "/admin/rounds", label: "รอบสั่งซื้อ" },
  { href: "/admin/entitlements", label: "สิทธิ์เครื่องแบบ" },
  { href: "/admin/products", label: "สินค้า" },
  { href: "/admin/orders", label: "คำสั่งซื้อ" },
  { href: "/admin/team", label: "ทีมผู้ดูแล" },
];

export function AdminNav() {
  const path = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto px-2 pb-2 md:flex-col md:pb-0">
      {links.map((l) => {
        const active = l.href === "/admin" ? path === "/admin" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={cx("shrink-0 rounded-lg px-3 py-2 text-sm", active ? "bg-white/10 font-semibold" : "opacity-75 hover:opacity-100")}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
