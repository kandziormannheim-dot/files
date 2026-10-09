-- AlterTable
ALTER TABLE "VideoProject" ADD COLUMN     "logoChip" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "logoName" TEXT,
ADD COLUMN     "logoPath" TEXT,
ADD COLUMN     "logoPosition" TEXT NOT NULL DEFAULT 'oben-links',
ADD COLUMN     "logoSize" TEXT NOT NULL DEFAULT 'mittel',
ADD COLUMN     "revisionNotes" TEXT[] DEFAULT ARRAY[]::TEXT[];
