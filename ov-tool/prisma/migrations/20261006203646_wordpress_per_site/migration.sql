-- Blogartikel je Webseite in WordPress (cdu-sf.de und/oder bbr.cdu-sf.de)

-- CreateTable
CREATE TABLE "WordpressPublication" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "site" TEXT NOT NULL,
    "wpPostId" INTEGER NOT NULL,
    "wpLink" TEXT NOT NULL,
    "wpStatus" TEXT NOT NULL,
    "wpMediaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WordpressPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WordpressPublication_postId_site_key" ON "WordpressPublication"("postId", "site");

-- AddForeignKey
ALTER TABLE "WordpressPublication" ADD CONSTRAINT "WordpressPublication_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MarketingPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bisherige Übertragungen übernehmen
INSERT INTO "WordpressPublication" ("id", "postId", "site", "wpPostId", "wpLink", "wpStatus", "wpMediaId", "updatedAt")
SELECT 'wp_' || "id", "id", COALESCE("site", 'SF'), "wpPostId", COALESCE("wpLink", ''), COALESCE("wpStatus", 'draft'), "wpMediaId", CURRENT_TIMESTAMP
FROM "MarketingPost" WHERE "wpPostId" IS NOT NULL;

-- AlterTable
ALTER TABLE "MarketingPost" DROP COLUMN "wpLink",
DROP COLUMN "wpMediaId",
DROP COLUMN "wpPostId",
DROP COLUMN "wpStatus";
