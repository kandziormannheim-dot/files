-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('ENTWURF', 'ANALYSE', 'SCHNITT', 'RENDERN', 'FERTIG', 'FEHLER');

-- CreateTable
CREATE TABLE "VideoProject" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "topic" TEXT NOT NULL DEFAULT '',
    "message" TEXT NOT NULL DEFAULT '',
    "callToAction" TEXT NOT NULL DEFAULT '',
    "direction" TEXT NOT NULL DEFAULT '',
    "account" TEXT NOT NULL DEFAULT 'OV',
    "formats" TEXT[],
    "maxSeconds" INTEGER NOT NULL DEFAULT 30,
    "subtitles" BOOLEAN NOT NULL DEFAULT true,
    "musicPath" TEXT,
    "musicName" TEXT,
    "musicVolume" INTEGER NOT NULL DEFAULT 15,
    "status" "VideoStatus" NOT NULL DEFAULT 'ENTWURF',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT NOT NULL DEFAULT '',
    "plan" JSONB,
    "planSource" TEXT,
    "outputs" JSONB,
    "renderedAt" TIMESTAMP(3),
    "consentConfirmedAt" TIMESTAMP(3),
    "consentConfirmedById" TEXT,
    "marketingPostId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VideoProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoClip" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "duration" DOUBLE PRECISION,
    "width" INTEGER,
    "height" INTEGER,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "hasAudio" BOOLEAN NOT NULL DEFAULT false,
    "stills" JSONB,
    "transcript" JSONB,
    "analyzedAt" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoClip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoProject_createdAt_idx" ON "VideoProject"("createdAt");

-- CreateIndex
CREATE INDEX "VideoClip_projectId_sortOrder_idx" ON "VideoClip"("projectId", "sortOrder");

-- AddForeignKey
ALTER TABLE "VideoProject" ADD CONSTRAINT "VideoProject_marketingPostId_fkey" FOREIGN KEY ("marketingPostId") REFERENCES "MarketingPost"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoProject" ADD CONSTRAINT "VideoProject_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoClip" ADD CONSTRAINT "VideoClip_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "VideoProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
