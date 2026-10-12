-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "OtpChannel" AS ENUM ('SMS', 'EMAIL');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('REGISTER', 'RESET_PASSWORD');

-- CreateEnum
CREATE TYPE "RoundType" AS ENUM ('BIG_LOT', 'NEW_JOINERS');

-- CreateEnum
CREATE TYPE "BenefitMode" AS ENUM ('FIXED', 'CREDIT');

-- CreateEnum
CREATE TYPE "PackingMode" AS ENUM ('PER_PERSON', 'PER_DEPARTMENT', 'PER_LOCATION');

-- CreateEnum
CREATE TYPE "OrderKind" AS ENUM ('WELFARE', 'PERSONAL');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('WORKPLACE', 'HOME');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PLACED', 'ROUND_CLOSED', 'PRODUCING', 'SHIPPING', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'PAID', 'REFUND_DUE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PROMPTPAY', 'MOBILE_BANKING', 'CREDIT_CARD', 'DEBIT_CARD');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ExtensionScope" AS ENUM ('ALL', 'DEPARTMENT', 'EMPLOYEES');

-- CreateEnum
CREATE TYPE "ExchangeReason" AS ENUM ('WRONG_SIZE', 'DEFECT', 'WRONG_ITEM');

-- CreateEnum
CREATE TYPE "ExchangeStatus" AS ENUM ('REQUESTED', 'APPROVED', 'COMPLETED', 'REJECTED');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "department" TEXT NOT NULL,
    "subDepartment" TEXT,
    "position" TEXT NOT NULL,
    "managerName" TEXT,
    "startDate" TIMESTAMP(3),
    "workLocation" TEXT,
    "workAddress" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "homeAddress" TEXT,
    "passwordHash" TEXT,
    "registeredAt" TIMESTAMP(3),
    "notifyEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifySms" BOOLEAN NOT NULL DEFAULT true,
    "notifyLine" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "channel" "OtpChannel" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "pendingPasswordHash" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" INTEGER NOT NULL,
    "sizes" TEXT[],
    "lengths" TEXT[],
    "creditAllowed" BOOLEAN NOT NULL DEFAULT true,
    "personalSale" BOOLEAN NOT NULL DEFAULT true,
    "departments" TEXT[],
    "stock" INTEGER NOT NULL DEFAULT 0,
    "shopifyProductId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntitlementRule" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "gender" "Gender",
    "department" TEXT,
    "position" TEXT,
    "minYears" INTEGER,
    "quantity" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EntitlementRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderRound" (
    "id" TEXT NOT NULL,
    "type" "RoundType" NOT NULL,
    "name" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "opensAt" TIMESTAMP(3) NOT NULL,
    "closesAt" TIMESTAMP(3) NOT NULL,
    "originalClosesAt" TIMESTAMP(3) NOT NULL,
    "deliveryDays" INTEGER NOT NULL DEFAULT 45,
    "creditEnabled" BOOLEAN NOT NULL DEFAULT true,
    "packing" "PackingMode" NOT NULL DEFAULT 'PER_PERSON',
    "allowEdits" BOOLEAN NOT NULL DEFAULT true,
    "closedEarlyAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundPolicy" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "mode" "BenefitMode" NOT NULL,
    "creditAmount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "RoundPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoundMember" (
    "roundId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,

    CONSTRAINT "RoundMember_pkey" PRIMARY KEY ("roundId","employeeId")
);

-- CreateTable
CREATE TABLE "RoundExtension" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "scope" "ExtensionScope" NOT NULL DEFAULT 'ALL',
    "department" TEXT,
    "employeeIds" TEXT[],
    "previousClosesAt" TIMESTAMP(3) NOT NULL,
    "newClosesAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoundExtension_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CartItem" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" "OrderKind" NOT NULL,
    "roundId" TEXT,
    "productId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "length" TEXT,
    "quantity" INTEGER NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CartItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "kind" "OrderKind" NOT NULL DEFAULT 'WELFARE',
    "employeeId" TEXT NOT NULL,
    "roundId" TEXT,
    "benefitMode" "BenefitMode",
    "status" "OrderStatus" NOT NULL DEFAULT 'PLACED',
    "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'WORKPLACE',
    "deliveryAddress" TEXT,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "creditUsed" INTEGER NOT NULL DEFAULT 0,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "amountPaid" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "paymentMethod" "PaymentMethod",
    "carrier" TEXT,
    "trackingNumber" TEXT,
    "editCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "length" TEXT,
    "quantity" INTEGER NOT NULL,
    "entitledQty" INTEGER NOT NULL,
    "extraQty" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "note" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus",
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRequest" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "reason" "ExchangeReason" NOT NULL,
    "details" TEXT NOT NULL,
    "status" "ExchangeStatus" NOT NULL DEFAULT 'REQUESTED',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboundMessage" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_employeeCode_key" ON "Employee"("employeeCode");

-- CreateIndex
CREATE INDEX "Employee_department_idx" ON "Employee"("department");

-- CreateIndex
CREATE INDEX "Employee_workLocation_idx" ON "Employee"("workLocation");

-- CreateIndex
CREATE INDEX "OtpCode_employeeId_purpose_idx" ON "OtpCode"("employeeId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "RoundPolicy_roundId_department_key" ON "RoundPolicy"("roundId", "department");

-- CreateIndex
CREATE INDEX "CartItem_employeeId_kind_idx" ON "CartItem"("employeeId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Order_orderNumber_key" ON "Order"("orderNumber");

-- CreateIndex
CREATE INDEX "Order_roundId_status_idx" ON "Order"("roundId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Order_employeeId_roundId_key" ON "Order"("employeeId", "roundId");

-- CreateIndex
CREATE INDEX "Notification_employeeId_createdAt_idx" ON "Notification"("employeeId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntitlementRule" ADD CONSTRAINT "EntitlementRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundPolicy" ADD CONSTRAINT "RoundPolicy_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "OrderRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundMember" ADD CONSTRAINT "RoundMember_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "OrderRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundMember" ADD CONSTRAINT "RoundMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoundExtension" ADD CONSTRAINT "RoundExtension_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "OrderRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "OrderRound"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "OrderRound"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRequest" ADD CONSTRAINT "ExchangeRequest_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRequest" ADD CONSTRAINT "ExchangeRequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
