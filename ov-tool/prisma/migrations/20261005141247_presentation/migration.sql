-- AlterTable
ALTER TABLE "AgendaItem" ADD COLUMN     "leaderNotes" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN     "inMinutes" BOOLEAN NOT NULL DEFAULT false;
