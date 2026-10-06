-- AlterTable
ALTER TABLE "MarketingPost" ADD COLUMN     "account" TEXT,
ADD COLUMN     "bbrConcernId" TEXT,
ADD COLUMN     "creative" JSONB,
ADD COLUMN     "generatedAt" TIMESTAMP(3),
ADD COLUMN     "imagePath" TEXT,
ADD COLUMN     "mediaError" TEXT,
ADD COLUMN     "sourceKey" TEXT,
ADD COLUMN     "variants" JSONB,
ADD COLUMN     "videoPath" TEXT;

-- CreateTable
CREATE TABLE "BbrConcern" (
    "id" TEXT NOT NULL,
    "deckCardId" INTEGER NOT NULL,
    "boardId" INTEGER NOT NULL DEFAULT 0,
    "stack" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "bezirk" TEXT,
    "kurzfassung" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "cardUrl" TEXT,
    "cardModifiedAt" TIMESTAMP(3),
    "genStatus" TEXT NOT NULL DEFAULT 'OFFEN',
    "genError" TEXT,
    "generatedAt" TIMESTAMP(3),
    "ignored" BOOLEAN NOT NULL DEFAULT false,
    "test" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BbrConcern_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BbrConcern_deckCardId_key" ON "BbrConcern"("deckCardId");

-- CreateIndex
CREATE INDEX "BbrConcern_genStatus_idx" ON "BbrConcern"("genStatus");

-- CreateIndex
CREATE INDEX "MarketingPost_bbrConcernId_idx" ON "MarketingPost"("bbrConcernId");

-- AddForeignKey
ALTER TABLE "MarketingPost" ADD CONSTRAINT "MarketingPost_bbrConcernId_fkey" FOREIGN KEY ("bbrConcernId") REFERENCES "BbrConcern"("id") ON DELETE SET NULL ON UPDATE CASCADE;
