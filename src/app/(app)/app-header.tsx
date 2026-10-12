import Link from "next/link";
import { db } from "@/lib/db";
import { initials } from "@/lib/format";
import { Logo } from "@/components/ui";
import type { Employee } from "@prisma/client";

export async function AppHeader({ emp }: { emp: Employee }) {
  const unread = await db.notification.count({ where: { employeeId: emp.id, readAt: null } });
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-white px-4">
      <Logo />
      <div className="flex items-center gap-2">
        <Link href="/notifications" aria-label="การแจ้งเตือน" className="relative grid h-9 w-9 place-items-center rounded-full hover:bg-gray-100">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0" />
          </svg>
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
              {unread}
            </span>
          )}
        </Link>
        <Link href="/account" className="grid h-8 w-8 place-items-center rounded-full bg-navy-100 text-xs font-bold text-navy">
          {initials(emp.firstName, emp.lastName)}
        </Link>
      </div>
    </header>
  );
}
