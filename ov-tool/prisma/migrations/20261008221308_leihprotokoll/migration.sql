-- CreateEnum
CREATE TYPE "LoanPhase" AS ENUM ('AUSGABE', 'RUECKGABE');

-- AlterTable
ALTER TABLE "InventoryLoan" ADD COLUMN     "accessories" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "accessoriesComplete" BOOLEAN,
ADD COLUMN     "borrowerEmail" TEXT,
ADD COLUMN     "borrowerName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "conditionIn" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "conditionOut" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "handedOverBy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "handedOverById" TEXT,
ADD COLUMN     "organization" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "outMailSentAt" TIMESTAMP(3),
ADD COLUMN     "receivedBy" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "receivedById" TEXT,
ADD COLUMN     "returnMailSentAt" TIMESTAMP(3),
ADD COLUMN     "returnNote" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "returnedByName" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "InventoryLoanPhoto" (
    "id" TEXT NOT NULL,
    "loanId" TEXT NOT NULL,
    "phase" "LoanPhase" NOT NULL,
    "path" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLoanPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryLoanPhoto_loanId_phase_idx" ON "InventoryLoanPhoto"("loanId", "phase");

-- CreateIndex
CREATE INDEX "InventoryLoan_returnedAt_idx" ON "InventoryLoan"("returnedAt");

-- AddForeignKey
ALTER TABLE "InventoryLoanPhoto" ADD CONSTRAINT "InventoryLoanPhoto_loanId_fkey" FOREIGN KEY ("loanId") REFERENCES "InventoryLoan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bestehende Leihvorgänge: bisheriges Feld „Verliehen an“ als Name übernehmen
UPDATE "InventoryLoan" SET "borrowerName" = "borrower" WHERE "borrowerName" = '';
