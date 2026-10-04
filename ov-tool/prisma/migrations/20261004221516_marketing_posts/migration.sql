-- CreateEnum
CREATE TYPE "MarketingKind" AS ENUM ('SOCIAL', 'BLOG');

-- CreateEnum
CREATE TYPE "MarketingStatus" AS ENUM ('ENTWURF', 'FREIGEGEBEN', 'VEROEFFENTLICHT');

-- CreateTable
CREATE TABLE "MarketingPost" (
    "id" TEXT NOT NULL,
    "kind" "MarketingKind" NOT NULL,
    "status" "MarketingStatus" NOT NULL DEFAULT 'ENTWURF',
    "title" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "brief" TEXT NOT NULL DEFAULT '',
    "channels" TEXT[],
    "hashtags" TEXT NOT NULL DEFAULT '',
    "site" TEXT,
    "plannedFor" TIMESTAMP(3),
    "wpPostId" INTEGER,
    "wpLink" TEXT,
    "wpStatus" TEXT,
    "publishedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingPost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketingPost_status_createdAt_idx" ON "MarketingPost"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "MarketingPost" ADD CONSTRAINT "MarketingPost_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingPost" ADD CONSTRAINT "MarketingPost_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
