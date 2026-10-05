-- AlterTable
ALTER TABLE "Link" ADD COLUMN     "bbrOnly" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isBbr" BOOLEAN NOT NULL DEFAULT false;
