-- AlterTable
ALTER TABLE "AgendaItem" ADD COLUMN     "minutesNote" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "agendaItemId" TEXT;

-- CreateIndex
CREATE INDEX "Attachment_agendaItemId_idx" ON "Attachment"("agendaItemId");
