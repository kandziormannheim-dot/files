-- CreateEnum
CREATE TYPE "MotionStatus" AS ENUM ('ENTWURF', 'EINGEREICHT');

-- CreateTable
CREATE TABLE "Motion" (
    "id" TEXT NOT NULL,
    "resolutionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "status" "MotionStatus" NOT NULL DEFAULT 'ENTWURF',
    "sentAt" TIMESTAMP(3),
    "sentById" TEXT,
    "ccEmail" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Motion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Motion_resolutionId_idx" ON "Motion"("resolutionId");

-- AddForeignKey
ALTER TABLE "Motion" ADD CONSTRAINT "Motion_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "Resolution"("id") ON DELETE CASCADE ON UPDATE CASCADE;
