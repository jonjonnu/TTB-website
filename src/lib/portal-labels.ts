// Labels and constants safe to use in client components.

export const CONTACT = { callCenter: "02-433-9881", line: "@songsmai", email: "info@songsmaigroup.com" };

export const DEPARTMENTS = ["Branch", "Wealth", "Back Office"] as const;

export const STATUS_STEPS = [
  { status: "PLACED", label: "ยืนยันคำสั่งซื้อ" },
  { status: "ROUND_CLOSED", label: "ปิดรอบสั่งซื้อ" },
  { status: "PRODUCING", label: "อยู่ระหว่างผลิต" },
  { status: "SHIPPING", label: "อยู่ระหว่างจัดส่ง" },
  { status: "DELIVERED", label: "จัดส่งสำเร็จ" },
] as const;

export const PERSONAL_STEPS = STATUS_STEPS.filter((s) => s.status !== "ROUND_CLOSED");

export const STATUS_LABEL: Record<string, string> = {
  ...Object.fromEntries(STATUS_STEPS.map((s) => [s.status, s.label])),
  CANCELLED: "ยกเลิก",
};

export const PAYMENT_LABEL: Record<string, string> = {
  NOT_REQUIRED: "ไม่มีค่าใช้จ่าย",
  PENDING: "รอชำระเงิน",
  PAID: "ชำระแล้ว",
  REFUND_DUE: "รอคืนเงินส่วนต่าง",
};

export const PAYMENT_METHODS = [
  { value: "PROMPTPAY", label: "QR PromptPay" },
  { value: "MOBILE_BANKING", label: "โมบายแบงก์กิ้ง" },
  { value: "CREDIT_CARD", label: "บัตรเครดิต" },
  { value: "DEBIT_CARD", label: "บัตรเดบิต" },
] as const;

export const PAYMENT_METHOD_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_METHODS.map((m) => [m.value, m.label]));

export const EXCHANGE_REASONS = [
  { value: "WRONG_SIZE", label: "ไซส์ไม่พอดี" },
  { value: "DEFECT", label: "สินค้าชำรุดจากการผลิต" },
  { value: "WRONG_ITEM", label: "ได้รับสินค้าผิดรายการ" },
] as const;

export const EXCHANGE_STATUS_LABEL: Record<string, string> = {
  REQUESTED: "รอตรวจสอบ",
  APPROVED: "อนุมัติ รอส่งสินค้าใหม่",
  COMPLETED: "เปลี่ยนสินค้าแล้ว",
  REJECTED: "ไม่อนุมัติ",
};

export const PACKING_LABEL: Record<string, string> = {
  PER_PERSON: "รายบุคคล",
  PER_DEPARTMENT: "รายหน่วยงาน",
  PER_LOCATION: "รายสาขา / สถานที่ทำงาน",
};

export function orderTitle(o: { kind: string; round?: { name: string } | null }) {
  return o.kind === "PERSONAL" ? "Personal Order" : (o.round?.name ?? "สวัสดิการ");
}
