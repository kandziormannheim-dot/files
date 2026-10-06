-- CreateTable
CREATE TABLE "SocialPublication" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "network" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "permalink" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocialPublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SocialPublication_postId_idx" ON "SocialPublication"("postId");

-- AddForeignKey
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_postId_fkey" FOREIGN KEY ("postId") REFERENCES "MarketingPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPublication" ADD CONSTRAINT "SocialPublication_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
