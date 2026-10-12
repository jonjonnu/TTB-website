// Sample data only: every name, phone number and email here is made up.
import { PrismaClient, type Gender, type OrderStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const DAY = 24 * 60 * 60 * 1000;

/** Bangkok-time date at hh:mm, `offset` days from today. */
function bkk(offset: number, hh: number, mm: number) {
  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
  const d = new Date(`${today}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+07:00`);
  return new Date(d.getTime() + offset * DAY);
}

const branches = [
  { code: "BKK01", name: "สาขาสีลม", region: "กรุงเทพฯ" },
  { code: "BKK02", name: "สาขาพหลโยธิน (สำนักงานใหญ่)", region: "กรุงเทพฯ" },
  { code: "BKK03", name: "สาขาบางนา", region: "กรุงเทพฯ" },
  { code: "CNX01", name: "สาขาเชียงใหม่", region: "ภาคเหนือ" },
  { code: "KKN01", name: "สาขาขอนแก่น", region: "ภาคตะวันออกเฉียงเหนือ" },
  { code: "HDY01", name: "สาขาหาดใหญ่", region: "ภาคใต้" },
];

const products = [
  { sku: "TTB-JK-F", name: "เสื้อสูทหญิง สีกรมท่า", price: 1290, sizes: ["XS", "S", "M", "L", "XL", "2XL"], lengths: ["สั้น", "ปกติ", "ยาว"], description: "ผ้าวูลผสม ทรงเข้ารูป ซับในเต็มตัว" },
  { sku: "TTB-SK-F", name: "กระโปรง สีกรมท่า", price: 590, sizes: ["24", "26", "28", "30", "32", "34"], lengths: ["สั้น", "ปกติ", "ยาว"], description: "กระโปรงทรงสอบ ผ่าหลัง" },
  { sku: "TTB-SH-F", name: "เสื้อเชิ้ตขาวหญิง แขนยาว", price: 450, sizes: ["XS", "S", "M", "L", "XL", "2XL"], lengths: [], description: "ผ้าคอตตอนผสม รีดง่าย" },
  { sku: "TTB-SC-F", name: "ผ้าพันคอ ลายองค์กร", price: 350, sizes: ["Free size"], lengths: [], description: "ผ้าซาตินพิมพ์ลาย TTB" },
  { sku: "TTB-JK-M", name: "เสื้อสูทชาย สีกรมท่า", price: 1490, sizes: ["S", "M", "L", "XL", "2XL", "3XL"], lengths: ["สั้น", "ปกติ", "ยาว"], description: "ผ้าวูลผสม ทรงสลิม" },
  { sku: "TTB-PT-M", name: "กางเกงสแล็คชาย สีกรมท่า", price: 690, sizes: ["28", "30", "32", "34", "36", "38"], lengths: ["สั้น", "ปกติ", "ยาว"], description: "ขากระบอกเล็ก" },
  { sku: "TTB-SH-M", name: "เสื้อเชิ้ตขาวชาย แขนยาว", price: 450, sizes: ["S", "M", "L", "XL", "2XL", "3XL"], lengths: [], description: "ผ้าคอตตอนผสม รีดง่าย" },
  { sku: "TTB-TIE", name: "เนคไท ลายองค์กร", price: 390, sizes: ["Free size"], lengths: [], description: "ผ้าไหมผสม" },
  { sku: "TTB-POLO", name: "เสื้อโปโล TTB (ใส่วันศุกร์)", price: 390, sizes: ["S", "M", "L", "XL", "2XL"], lengths: [], description: "ไม่อยู่ในสิทธิ์ ซื้อเพิ่มได้" },
];

const firstF = ["ณัฐธิดา", "สุภาพร", "กมลชนก", "ปิยะนุช", "อรอุมา", "ศิริพร", "จิราพร", "พิมพ์ชนก", "วรรณิภา", "ธิดารัตน์", "ชนิดา", "มาลัย"];
const firstM = ["ธนกร", "ปกรณ์", "วีรยุทธ", "สมชาย", "อนุชา", "ภาณุพงศ์", "กิตติพัฒน์", "ณัฐวุฒิ", "ศุภชัย", "วรวิทย์", "ชยพล", "ธีรวัฒน์"];
const last = ["ศรีสุข", "ใจดี", "มั่นคง", "รุ่งเรือง", "แสงทอง", "บุญมา", "สุขสวัสดิ์", "ทองดี", "วงศ์ไทย", "พรหมมา", "เจริญผล", "ศักดิ์สิทธิ์"];
const orgs = [
  { department: "สาขา", subDepartment: "บริการลูกค้า", position: "เจ้าหน้าที่บริการลูกค้า" },
  { department: "สาขา", subDepartment: "บริการลูกค้า", position: "ผู้จัดการสาขา" },
  { department: "สาขา", subDepartment: "สินเชื่อ", position: "เจ้าหน้าที่สินเชื่อ" },
  { department: "สำนักงานใหญ่", subDepartment: "ทรัพยากรบุคคล", position: "เจ้าหน้าที่" },
  { department: "สำนักงานใหญ่", subDepartment: "การตลาด", position: "เจ้าหน้าที่" },
];

async function main() {
  console.log("Clearing old data…");
  await db.$transaction([
    db.notification.deleteMany(),
    db.outboundMessage.deleteMany(),
    db.payment.deleteMany(),
    db.orderEvent.deleteMany(),
    db.orderItem.deleteMany(),
    db.order.deleteMany(),
    db.cartItem.deleteMany(),
    db.roundExtension.deleteMany(),
    db.orderRound.deleteMany(),
    db.entitlementRule.deleteMany(),
    db.product.deleteMany(),
    db.otpCode.deleteMany(),
    db.employee.deleteMany(),
    db.branch.deleteMany(),
    db.adminUser.deleteMany(),
    db.setting.deleteMany(),
  ]);

  const branchRows = await Promise.all(branches.map((b) => db.branch.create({ data: b })));
  const productRows = await Promise.all(products.map((p, i) => db.product.create({ data: { ...p, sortOrder: i } })));
  const P = Object.fromEntries(productRows.map((p) => [p.sku, p]));

  await db.entitlementRule.createMany({
    data: [
      { productId: P["TTB-JK-F"].id, gender: "FEMALE", quantity: 1 },
      { productId: P["TTB-SK-F"].id, gender: "FEMALE", quantity: 2 },
      { productId: P["TTB-SH-F"].id, gender: "FEMALE", quantity: 3 },
      { productId: P["TTB-SC-F"].id, gender: "FEMALE", department: "สาขา", quantity: 1 },
      { productId: P["TTB-JK-M"].id, gender: "MALE", quantity: 1 },
      { productId: P["TTB-PT-M"].id, gender: "MALE", quantity: 2 },
      { productId: P["TTB-SH-M"].id, gender: "MALE", quantity: 3 },
      { productId: P["TTB-TIE"].id, gender: "MALE", department: "สาขา", quantity: 1 },
      { productId: P["TTB-JK-F"].id, gender: "FEMALE", position: "ผู้จัดการสาขา", quantity: 2 },
      { productId: P["TTB-JK-M"].id, gender: "MALE", position: "ผู้จัดการสาขา", quantity: 2 },
    ],
  });

  const pw = await bcrypt.hash("ttb12345", 10);
  console.log("Creating employees…");
  const employees = [];
  // The demo employee shown in the mockup.
  employees.push(
    await db.employee.create({
      data: {
        employeeCode: "1100231",
        firstName: "ณัฐธิดา",
        lastName: "ศรีสุข",
        gender: "FEMALE",
        department: "สาขา",
        subDepartment: "บริการลูกค้า",
        position: "เจ้าหน้าที่บริการลูกค้า",
        managerName: "วรรณา ก.",
        email: "nattida.demo@example.com",
        phone: "0810004521",
        branchId: branchRows[0].id,
        passwordHash: pw,
        registeredAt: bkk(-30, 10, 0),
      },
    }),
  );
  for (let i = 0; i < 59; i++) {
    const gender: Gender = i % 2 === 0 ? "FEMALE" : "MALE";
    const org = orgs[i % orgs.length];
    const registered = i < 42;
    employees.push(
      await db.employee.create({
        data: {
          employeeCode: String(1100300 + i),
          firstName: (gender === "FEMALE" ? firstF : firstM)[i % 12],
          lastName: last[(i * 5) % 12],
          gender,
          ...org,
          managerName: "วรรณา ก.",
          email: `employee${i + 1}@example.com`,
          phone: `08100${String(10000 + i).slice(-5)}`,
          branchId: branchRows[i % branchRows.length].id,
          passwordHash: registered ? pw : null,
          registeredAt: registered ? bkk(-20 + (i % 15), 9, 0) : null,
        },
      }),
    );
  }

  // An employee who exists in the HR list but hasn't signed up, for testing OTP registration.
  await db.employee.create({
    data: {
      employeeCode: "1100999",
      firstName: "ทดลอง",
      lastName: "ลงทะเบียน",
      gender: "MALE",
      department: "สาขา",
      subDepartment: "บริการลูกค้า",
      position: "เจ้าหน้าที่บริการลูกค้า",
      email: "signup.demo@example.com",
      phone: "0810009999",
      branchId: branchRows[1].id,
    },
  });

  console.log("Creating rounds and orders…");
  const year = Number(bkk(0, 12, 0).toISOString().slice(0, 4));
  const current = await db.orderRound.create({
    data: {
      year,
      roundNumber: 2,
      opensAt: bkk(-2, 9, 0),
      closesAt: bkk(4, 23, 59),
      originalClosesAt: bkk(4, 23, 59),
      deliveryDays: 45,
      homeDeliveryFee: 150,
    },
  });
  const past = [
    { year, roundNumber: 1, open: -200, status: "SHIPPED" as OrderStatus },
    { year: year - 1, roundNumber: 2, open: -380, status: "DELIVERED" as OrderStatus },
    { year: year - 1, roundNumber: 1, open: -560, status: "DELIVERED" as OrderStatus },
  ];
  const rules = await db.entitlementRule.findMany();
  for (const pr of past) {
    const r = await db.orderRound.create({
      data: {
        year: pr.year,
        roundNumber: pr.roundNumber,
        opensAt: bkk(pr.open, 9, 0),
        closesAt: bkk(pr.open + 6, 23, 59),
        originalClosesAt: bkk(pr.open + 6, 23, 59),
      },
    });
    let n = 0;
    for (const emp of employees.slice(0, 40)) {
      if (pr.roundNumber === 1 && pr.year === year - 1 && emp.employeeCode === "1100231") continue; // demo: skipped a round
      n++;
      await createOrder(r.id, `TTB-${pr.year}-${pr.roundNumber}-${String(n).padStart(4, "0")}`, emp, rules, pr.status, bkk(pr.open + 2, 14, 0));
    }
  }

  // Current round: ~half of registered employees ordered already (not the demo user, so the demo can order).
  let n = 0;
  for (const emp of employees.slice(1, 25)) {
    n++;
    await createOrder(current.id, `TTB-${year}-2-${String(n).padStart(4, "0")}`, emp, rules, "PLACED", bkk(-1, 11, n));
  }

  await db.notification.createMany({
    data: [
      {
        employeeId: employees[0].id,
        kind: "STATUS",
        title: "จัดส่งถึงสาขาแล้ว",
        body: `คำสั่งซื้อ TTB-${year}-1-0001 พร้อมรับที่สาขา`,
        createdAt: bkk(-150, 10, 0),
        readAt: bkk(-150, 12, 0),
      },
      {
        employeeId: employees[0].id,
        kind: "REMINDER",
        title: "เปิดรอบสั่งซื้อแล้ว",
        body: `ปี ${year} รอบที่ 2 เปิดรับแล้ว เข้าระบบเพื่อเลือกไซส์ตามสิทธิ์ของคุณ`,
        href: "/",
        createdAt: bkk(-2, 9, 0),
      },
    ],
  });

  await db.adminUser.createMany({
    data: [
      { email: "owner@example.com", name: "Songsmai Owner", role: "OWNER", passwordHash: await bcrypt.hash("admin12345", 10) },
      { email: "hr@example.com", name: "ฝ่ายบุคคล TTB", role: "ADMIN", passwordHash: await bcrypt.hash("admin12345", 10) },
    ],
  });

  console.log("Done.");
  console.log("Employee login: 1100231 / ttb12345   (sign-up test: employee code 1100999)");
  console.log("Admin login:    owner@example.com / admin12345");
}

async function createOrder(
  roundId: string,
  orderNumber: string,
  emp: { id: string; gender: Gender; department: string; position: string; branchId: string | null },
  rules: { productId: string; gender: Gender | null; department: string | null; position: string | null; quantity: number }[],
  status: OrderStatus,
  at: Date,
) {
  const entitled = new Map<string, number>();
  for (const r of rules) {
    if ((r.gender ?? emp.gender) !== emp.gender || (r.department ?? emp.department) !== emp.department || (r.position ?? emp.position) !== emp.position) continue;
    entitled.set(r.productId, Math.max(entitled.get(r.productId) ?? 0, r.quantity));
  }
  const prods = await db.product.findMany({ where: { id: { in: [...entitled.keys()] } } });
  const sizeFor = (sizes: string[]) => sizes[Math.min(2, sizes.length - 1)];
  const steps: OrderStatus[] = ["PLACED", "ROUND_CLOSED", "REVIEWING", "PRODUCING", "SHIPPED", "DELIVERED"];
  const labels = ["สั่งคำสั่งซื้อแล้ว", "ปิดรอบสั่งซื้อ", "ตรวจสอบคำสั่งซื้อ", "กำลังตัดเย็บ", "จัดส่งแล้ว", "ได้รับสินค้าแล้ว"];
  await db.order.create({
    data: {
      orderNumber,
      employeeId: emp.id,
      roundId,
      status,
      branchId: emp.branchId,
      createdAt: at,
      items: {
        create: prods.map((p) => ({
          productId: p.id,
          size: sizeFor(p.sizes),
          length: p.lengths.length ? "ปกติ" : null,
          quantity: entitled.get(p.id)!,
          entitledQty: entitled.get(p.id)!,
          extraQty: 0,
          unitPrice: p.price,
        })),
      },
      events: {
        create: steps.slice(0, steps.indexOf(status) + 1).map((s, i) => ({ status: s, message: labels[i], createdAt: new Date(at.getTime() + i * 10 * DAY) })),
      },
    },
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
