-- CreateIndex
CREATE INDEX "ExchangeRequest_orderId_idx" ON "ExchangeRequest"("orderId");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "RoundMember_employeeId_idx" ON "RoundMember"("employeeId");


-- CreateTable
CREATE TABLE "OrderCounter" (
    "prefix" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "OrderCounter_pkey" PRIMARY KEY ("prefix")
);
