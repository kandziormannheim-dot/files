-- CreateEnum
CREATE TYPE "ExpensePayout" AS ENUM ('SPENDE', 'UEBERWEISUNG', 'BAR');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('ENTWURF', 'EINGEREICHT', 'VERSENDET', 'ERLEDIGT', 'ABGELEHNT');

-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "claimantId" TEXT NOT NULL,
    "claimantName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "occasion" TEXT NOT NULL DEFAULT '',
    "payout" "ExpensePayout" NOT NULL,
    "personalData" TEXT NOT NULL DEFAULT '',
    "personalEnc" BOOLEAN NOT NULL DEFAULT false,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'ENTWURF',
    "note" TEXT NOT NULL DEFAULT '',
    "submittedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sentTo" TEXT NOT NULL DEFAULT '',
    "doneAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseItem" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "receiptPath" TEXT,
    "receiptName" TEXT NOT NULL DEFAULT '',
    "receiptMime" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseClaim_number_key" ON "ExpenseClaim"("number");

-- CreateIndex
CREATE INDEX "ExpenseClaim_claimantId_createdAt_idx" ON "ExpenseClaim"("claimantId", "createdAt");

-- CreateIndex
CREATE INDEX "ExpenseClaim_status_idx" ON "ExpenseClaim"("status");

-- CreateIndex
CREATE INDEX "ExpenseItem_claimId_date_idx" ON "ExpenseItem"("claimId", "date");

-- AddForeignKey
ALTER TABLE "ExpenseItem" ADD CONSTRAINT "ExpenseItem_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ExpenseClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;
