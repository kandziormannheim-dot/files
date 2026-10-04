-- CreateEnum
CREATE TYPE "LinkCategory" AS ENUM ('PARTEI', 'OV_WEBSEITE', 'SOCIAL_MEDIA', 'VERWALTUNG', 'PRESSE', 'SONSTIGES');

-- CreateTable
CREATE TABLE "Link" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "category" "LinkCategory" NOT NULL DEFAULT 'SONSTIGES',
    "description" TEXT NOT NULL DEFAULT '',
    "accessNote" TEXT NOT NULL DEFAULT '',
    "editorialNote" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Link_category_position_idx" ON "Link"("category", "position");

-- AddForeignKey
ALTER TABLE "Link" ADD CONSTRAINT "Link_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
