-- CreateEnum
CREATE TYPE "ElectionStatus" AS ENUM ('PLANUNG', 'LAUFEND', 'ABGESCHLOSSEN');

-- CreateEnum
CREATE TYPE "ElectionMode" AS ENUM ('EINZEL', 'SAMMEL');

-- CreateEnum
CREATE TYPE "ElectionStage" AS ENUM ('WAHLGANG', 'STICHWAHL', 'LOS');

-- CreateEnum
CREATE TYPE "LandingKind" AS ENUM ('VERANSTALTUNG', 'KAMPAGNE', 'UMFRAGE', 'UNTERSTUETZER', 'PERSON', 'LINKS');

-- CreateEnum
CREATE TYPE "LandingStatus" AS ENUM ('ENTWURF', 'FREIGEGEBEN', 'ARCHIVIERT');

-- CreateEnum
CREATE TYPE "PressStatus" AS ENUM ('ENTWURF', 'FREIGEGEBEN', 'VEROEFFENTLICHT');

-- CreateEnum
CREATE TYPE "PressContactStatus" AS ENUM ('UNBESTAETIGT', 'WARTET', 'AKTIV', 'ABGEMELDET');

-- CreateTable
CREATE TABLE "Election" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "status" "ElectionStatus" NOT NULL DEFAULT 'PLANUNG',
    "presentEligible" INTEGER,
    "chair" TEXT NOT NULL DEFAULT '',
    "countingCommittee" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Election_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionPosition" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" "ElectionMode" NOT NULL DEFAULT 'EINZEL',
    "seats" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ElectionPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionCandidate" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "withdrawn" BOOLEAN NOT NULL DEFAULT false,
    "accepted" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionCandidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ElectionRound" (
    "id" TEXT NOT NULL,
    "positionId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "stage" "ElectionStage" NOT NULL,
    "round" INTEGER NOT NULL,
    "candidateIds" TEXT[],
    "ballotsCast" INTEGER NOT NULL DEFAULT 0,
    "invalid" INTEGER NOT NULL DEFAULT 0,
    "abstentions" INTEGER NOT NULL DEFAULT 0,
    "noVotes" INTEGER NOT NULL DEFAULT 0,
    "votes" JSONB NOT NULL DEFAULT '{}',
    "resultKind" TEXT NOT NULL,
    "resultText" TEXT NOT NULL,
    "elected" TEXT[],
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElectionRound_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Poll" (
    "id" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "options" TEXT[],
    "multiple" BOOLEAN NOT NULL DEFAULT false,
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "closesAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Poll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollVote" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "choices" INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingPage" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "LandingKind" NOT NULL,
    "status" "LandingStatus" NOT NULL DEFAULT 'ENTWURF',
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "eventAt" TIMESTAMP(3),
    "eventLocation" TEXT NOT NULL DEFAULT '',
    "links" JSONB NOT NULL DEFAULT '[]',
    "formEnabled" BOOLEAN NOT NULL DEFAULT false,
    "formTitle" TEXT NOT NULL DEFAULT '',
    "askPhone" BOOLEAN NOT NULL DEFAULT false,
    "askMessage" BOOLEAN NOT NULL DEFAULT false,
    "messageLabel" TEXT NOT NULL DEFAULT '',
    "consentText" TEXT NOT NULL DEFAULT '',
    "newsletterOption" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3),
    "retentionDays" INTEGER NOT NULL DEFAULT 90,
    "views" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LandingPage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LandingSubmission" (
    "id" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "encrypted" BOOLEAN NOT NULL DEFAULT false,
    "newsletter" BOOLEAN NOT NULL DEFAULT false,
    "confirmHash" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LandingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressRelease" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "PressStatus" NOT NULL DEFAULT 'ENTWURF',
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "quoteGiver" TEXT NOT NULL DEFAULT '',
    "embargoUntil" TIMESTAMP(3),
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PressRelease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressContact" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "medium" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "topics" TEXT NOT NULL DEFAULT '',
    "status" "PressContactStatus" NOT NULL DEFAULT 'UNBESTAETIGT',
    "confirmHash" TEXT,
    "unsubscribeToken" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PressContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressClipping" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "medium" TEXT NOT NULL,
    "publishedOn" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL DEFAULT '',
    "note" TEXT NOT NULL DEFAULT '',
    "releaseId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PressClipping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "warnDays" INTEGER NOT NULL DEFAULT 14,
    "note" TEXT NOT NULL DEFAULT '',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deadline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Election_date_idx" ON "Election"("date");

-- CreateIndex
CREATE INDEX "ElectionPosition_electionId_sortOrder_idx" ON "ElectionPosition"("electionId", "sortOrder");

-- CreateIndex
CREATE INDEX "ElectionCandidate_positionId_idx" ON "ElectionCandidate"("positionId");

-- CreateIndex
CREATE UNIQUE INDEX "ElectionRound_positionId_sequence_key" ON "ElectionRound"("positionId", "sequence");

-- CreateIndex
CREATE INDEX "Poll_createdAt_idx" ON "Poll"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PollVote_pollId_userId_key" ON "PollVote"("pollId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "LandingPage_slug_key" ON "LandingPage"("slug");

-- CreateIndex
CREATE INDEX "LandingPage_status_idx" ON "LandingPage"("status");

-- CreateIndex
CREATE UNIQUE INDEX "LandingSubmission_confirmHash_key" ON "LandingSubmission"("confirmHash");

-- CreateIndex
CREATE INDEX "LandingSubmission_pageId_createdAt_idx" ON "LandingSubmission"("pageId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PressRelease_slug_key" ON "PressRelease"("slug");

-- CreateIndex
CREATE INDEX "PressRelease_status_publishedAt_idx" ON "PressRelease"("status", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PressContact_email_key" ON "PressContact"("email");

-- CreateIndex
CREATE UNIQUE INDEX "PressContact_confirmHash_key" ON "PressContact"("confirmHash");

-- CreateIndex
CREATE UNIQUE INDEX "PressContact_unsubscribeToken_key" ON "PressContact"("unsubscribeToken");

-- CreateIndex
CREATE INDEX "PressContact_status_idx" ON "PressContact"("status");

-- CreateIndex
CREATE INDEX "PressClipping_publishedOn_idx" ON "PressClipping"("publishedOn");

-- CreateIndex
CREATE INDEX "Deadline_dueAt_idx" ON "Deadline"("dueAt");

-- AddForeignKey
ALTER TABLE "ElectionPosition" ADD CONSTRAINT "ElectionPosition_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionCandidate" ADD CONSTRAINT "ElectionCandidate_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ElectionPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElectionRound" ADD CONSTRAINT "ElectionRound_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "ElectionPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollVote" ADD CONSTRAINT "PollVote_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "Poll"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LandingSubmission" ADD CONSTRAINT "LandingSubmission_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "LandingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressClipping" ADD CONSTRAINT "PressClipping_releaseId_fkey" FOREIGN KEY ("releaseId") REFERENCES "PressRelease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
