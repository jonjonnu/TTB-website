"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const links = [
  { href: "/admin", label: "แดชบอร์ด", icon: "M4 20V10m6 10V4m6 16v-7m4 7H2" },
  { href: "/admin/employees", label: "พนักงานและคำสั่งซื้อ", icon: "M16 19a4 4 0 0 0-8 0m4-7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm6 7a3 3 0 0 0-3-3m1-4a2.5 2.5 0 1 0 0-5" },
  { href: "/admin/rounds", label: "รอบสั่งซื้อและเครดิต", icon: "M4 6h16v14H4zM4 10h16M8 3v4m8-4v4" },
  { href: "/admin/new-joiners", label: "New Joiners", icon: "M15 19a4 4 0 0 0-8 0m4-7a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3v6m3-3h-6" },
  { href: "/admin/entitlements", label: "สิทธิ์เครื่องแบบ", icon: "M12 6a2 2 0 1 1 2 2c-1 0-2 .5-2 1.5V10l9 6.5H3L12 10" },
  { href: "/admin/products", label: "สินค้าและราคา", icon: "M3 12V4h8l10 10-8 8L3 12Zm5-4h.01" },
  { href: "/admin/orders", label: "Personal และเปลี่ยนสินค้า", icon: "M4 9h16l-1 11H5L4 9Zm0 0 2-5h12l2 5" },
  { href: "/admin/team", label: "ทีมผู้ดูแล", icon: "M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z" },
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
            className={cx("flex shrink-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm", active ? "bg-white/10 font-medium" : "opacity-75 hover:opacity-100")}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d={l.icon} />
            </svg>
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
