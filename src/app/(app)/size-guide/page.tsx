import Link from "next/link";
import { TopBar, cx } from "@/components/ui";

// Placeholder measurements until Songsmai supplies TTB's standard size table.
const TABLES = {
  FEMALE: [
    ["XS", 80, 64, 36],
    ["S", 84, 68, 37],
    ["M", 88, 72, 38],
    ["L", 94, 78, 40],
    ["XL", 100, 84, 41],
    ["2XL", 106, 90, 42],
  ],
  MALE: [
    ["S", 92, 76, 42],
    ["M", 98, 82, 44],
    ["L", 104, 88, 46],
    ["XL", 110, 94, 48],
    ["2XL", 116, 100, 50],
    ["3XL", 122, 106, 52],
  ],
} as const;

export default async function SizeGuidePage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const g = (await searchParams).g === "MALE" ? "MALE" : "FEMALE";
  return (
    <>
      <TopBar title="คู่มือเลือกไซส์" back="/" />
      <main className="space-y-3 px-4 py-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-white p-1">
          {(["FEMALE", "MALE"] as const).map((x) => (
            <Link key={x} href={`/size-guide?g=${x}`} className={cx("rounded-md py-2 text-center text-sm", g === x ? "bg-navy text-white" : "")}>
              {x === "FEMALE" ? "หญิง" : "ชาย"}
            </Link>
          ))}
        </div>
        <div className="rounded-xl bg-white p-3">
          <p className="mb-2 font-medium">ตารางไซส์มาตรฐานธนาคาร · {g === "FEMALE" ? "หญิง" : "ชาย"} (ซม.)</p>
          <table className="w-full text-center text-sm">
            <thead className="bg-cream text-xs text-muted">
              <tr>
                {["ไซส์", "รอบอก", "รอบเอว", "ไหล่"].map((h) => (
                  <th key={h} className="py-1.5 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TABLES[g].map((r) => (
                <tr key={r[0]} className="border-b border-line last:border-0">
                  {r.map((c, i) => (
                    <td key={i} className={cx("py-2", i === 0 && "font-medium")}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-muted">[ค่าตัวอย่าง รอตาราง Size มาตรฐานของ TTB]</p>
        </div>
        <div className="space-y-2 rounded-xl bg-white p-3 text-sm">
          <p className="font-medium">วิธีวัดตัว</p>
          <div className="grid h-36 place-items-center rounded-lg bg-sand text-xs text-muted">[ภาพประกอบการวัดตัว]</div>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              <b>รอบอก</b> วัดรอบส่วนที่กว้างที่สุดของหน้าอก สายวัดขนานพื้น
            </li>
            <li>
              <b>รอบเอว</b> วัดรอบเอวตรงตำแหน่งที่ใส่กางเกงหรือกระโปรง
            </li>
            <li>
              <b>ไหล่</b> วัดจากปลายไหล่ซ้ายถึงปลายไหล่ขวาด้านหลัง
            </li>
          </ol>
        </div>
        <div className="rounded-xl bg-navy p-3 text-sm text-white">
          <p className="font-medium">ไม่แน่ใจไซส์?</p>
          <p className="text-xs opacity-85">
            เลือก &ldquo;ปกติ&rdquo; สำหรับความยาว หรือปรึกษา Songsmai 02-433-9881 · LINE @songsmai ถ้าไซส์ไม่พอดี เปลี่ยนได้หลังรับสินค้า
          </p>
        </div>
      </main>
    </>
  );
}
