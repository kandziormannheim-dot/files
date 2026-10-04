-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('OFFEN', 'IN_ARBEIT', 'ERLEDIGT');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('NIEDRIG', 'NORMAL', 'HOCH');

-- CreateEnum
CREATE TYPE "AssigneeGroup" AS ENUM ('KEINE', 'VORSTAND', 'ALLE');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('VORSTANDSSITZUNG', 'ERWEITERTE_VORSTANDSSITZUNG', 'KLAUSURTAGUNG', 'SONSTIGE');

-- CreateEnum
CREATE TYPE "MeetingFormat" AS ENUM ('PRAESENZ', 'DIGITAL', 'HYBRID');

-- CreateEnum
CREATE TYPE "MeetingStatus" AS ENUM ('GEPLANT', 'EINGELADEN', 'DURCHGEFUEHRT', 'AUFGEHOBEN', 'ABGESAGT');

-- CreateEnum
CREATE TYPE "AgendaItemStatus" AS ENUM ('OFFEN', 'BEHANDELT', 'ABGESETZT', 'VERTAGT');

-- CreateEnum
CREATE TYPE "AgendaItemKind" AS ENUM ('NORMAL', 'PROTOKOLLGENEHMIGUNG', 'AUFGABENBERICHT', 'TERMINE', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('OFFEN', 'UEBERNOMMEN', 'VERWORFEN');

-- CreateEnum
CREATE TYPE "RsvpResponse" AS ENUM ('OFFEN', 'ZUGESAGT', 'ABGESAGT');

-- CreateEnum
CREATE TYPE "Presence" AS ENUM ('ANWESEND', 'ANWESEND_DIGITAL', 'ENTSCHULDIGT', 'NICHT_ANWESEND');

-- CreateEnum
CREATE TYPE "MinutesStatus" AS ENUM ('ENTWURF', 'VERSENDET', 'GENEHMIGT');

-- CreateEnum
CREATE TYPE "ApprovalMode" AS ENUM ('SITZUNG', 'UMLAUF');

-- CreateEnum
CREATE TYPE "OutcomeType" AS ENUM ('BESCHLUSS', 'ERGEBNIS');

-- CreateEnum
CREATE TYPE "ResolutionResult" AS ENUM ('ANGENOMMEN_EINSTIMMIG', 'ANGENOMMEN_MEHRHEITLICH', 'ABGELEHNT', 'FESTGESTELLT', 'ABGESETZT', 'VERTAGT', 'KENNTNISNAHME');

-- CreateEnum
CREATE TYPE "CirculationStatus" AS ENUM ('LAUFEND', 'ANGENOMMEN', 'ABGELEHNT', 'UNZULAESSIG', 'ABGEBROCHEN');

-- CreateEnum
CREATE TYPE "CirculationVoteValue" AS ENUM ('JA', 'NEIN', 'ENTHALTUNG', 'WIDERSPRUCH');

-- CreateEnum
CREATE TYPE "TranscriptSource" AS ENUM ('HANDY', 'PLAUD', 'TEAMS', 'ZOOM', 'SONSTIGE');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('HOCHGELADEN', 'TRANSKRIPTION', 'TRANSKRIBIERT', 'ENTWURF_LAEUFT', 'ENTWURF_FERTIG', 'FEHLER');

-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('INFOSTAND', 'PLAKATAKTION', 'VERANSTALTUNG', 'BUERGERGESPRAECH', 'SONSTIGES');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('GEPLANT', 'BESTAETIGT', 'DURCHGEFUEHRT', 'ABGESAGT');

-- CreateEnum
CREATE TYPE "District" AS ENUM ('SECKENHEIM', 'FRIEDRICHSFELD', 'BEIDE');

-- CreateEnum
CREATE TYPE "TopicStatus" AS ENUM ('NEU', 'IN_BEARBEITUNG', 'BEI_STADTRAETEN', 'IM_BEZIRKSBEIRAT', 'PRESSE', 'ERLEDIGT', 'ZURUECKGESTELLT');

-- CreateEnum
CREATE TYPE "TopicEventType" AS ENUM ('NOTIZ', 'STATUS', 'ANFRAGE', 'ANTWORT_VERWALTUNG', 'PRESSE', 'SITZUNG', 'SONSTIGES');

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "assigneeGroup" "AssigneeGroup" NOT NULL DEFAULT 'KEINE',
    "dueDate" TIMESTAMP(3),
    "dueText" TEXT NOT NULL DEFAULT '',
    "status" "TaskStatus" NOT NULL DEFAULT 'OFFEN',
    "priority" "TaskPriority",
    "completedAt" TIMESTAMP(3),
    "remindedBeforeAt" TIMESTAMP(3),
    "remindedOverdueAt" TIMESTAMP(3),
    "meetingId" TEXT,
    "agendaItemId" TEXT,
    "resolutionId" TEXT,
    "actionId" TEXT,
    "topicId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId","userId")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL DEFAULT 'VORSTANDSSITZUNG',
    "format" "MeetingFormat" NOT NULL DEFAULT 'PRAESENZ',
    "title" TEXT NOT NULL DEFAULT '',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT NOT NULL DEFAULT '',
    "onlineUrl" TEXT NOT NULL DEFAULT '',
    "status" "MeetingStatus" NOT NULL DEFAULT 'GEPLANT',
    "responseDeadline" TIMESTAMP(3),
    "invitationSentAt" TIMESTAMP(3),
    "invitationTemplateVersion" INTEGER,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "urgencyReason" TEXT NOT NULL DEFAULT '',
    "isRepeatAfterNoQuorum" BOOLEAN NOT NULL DEFAULT false,
    "previousMeetingId" TEXT,
    "openedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "interruptionNote" TEXT NOT NULL DEFAULT '',
    "chairNote" TEXT NOT NULL DEFAULT '',
    "quorumDeterminedAt" TIMESTAMP(3),
    "quorumDeterminedBy" TEXT NOT NULL DEFAULT '',
    "quorumPresent" INTEGER,
    "quorumEligible" INTEGER,
    "quorumReached" BOOLEAN,
    "cancelReason" TEXT NOT NULL DEFAULT '',
    "cancelledAt" TIMESTAMP(3),
    "extraAttendees" TEXT NOT NULL DEFAULT '',
    "rsvpReminderSentAt" TIMESTAMP(3),
    "invitationWarningSentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaItem" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "parentId" TEXT,
    "position" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "AgendaItemStatus" NOT NULL DEFAULT 'OFFEN',
    "kind" "AgendaItemKind" NOT NULL DEFAULT 'NORMAL',
    "topicId" TEXT,
    "minutesToApproveId" TEXT,
    "proposalId" TEXT,
    "carriedOverFromId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgendaItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgendaProposal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "proposedById" TEXT,
    "meetingId" TEXT,
    "status" "ProposalStatus" NOT NULL DEFAULT 'OFFEN',
    "isConveneRequest" BOOLEAN NOT NULL DEFAULT false,
    "adminNotifiedAt" TIMESTAMP(3),
    "decisionNote" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgendaProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalSupporter" (
    "proposalId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalSupporter_pkey" PRIMARY KEY ("proposalId","userId")
);

-- CreateTable
CREATE TABLE "Attendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" "RsvpResponse" NOT NULL DEFAULT 'OFFEN',
    "respondedAt" TIMESTAMP(3),
    "responseToken" TEXT NOT NULL,
    "presence" "Presence",
    "arrivedAt" TIMESTAMP(3),
    "leftAt" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "nameSnapshot" TEXT NOT NULL,
    "functionSnapshot" TEXT NOT NULL DEFAULT '',
    "votingSnapshot" "VotingRight" NOT NULL,
    "sortSnapshot" INTEGER NOT NULL DEFAULT 100,

    CONSTRAINT "Attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Minutes" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "status" "MinutesStatus" NOT NULL DEFAULT 'ENTWURF',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isCurrent" BOOLEAN NOT NULL DEFAULT true,
    "previousVersionId" TEXT,
    "changeNote" TEXT NOT NULL DEFAULT '',
    "recorderName" TEXT NOT NULL DEFAULT '',
    "formalities" JSONB NOT NULL DEFAULT '{}',
    "signers" JSONB NOT NULL DEFAULT '[]',
    "approvalMode" "ApprovalMode",
    "approvedAtMeetingId" TEXT,
    "sentAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "sentToOfficeAt" TIMESTAMP(3),
    "templateVersion" INTEGER,
    "aiUncertainties" JSONB,
    "aiMisc" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Minutes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MinutesSection" (
    "id" TEXT NOT NULL,
    "minutesId" TEXT NOT NULL,
    "agendaItemId" TEXT,
    "points" JSONB NOT NULL DEFAULT '[]',
    "outcomeType" "OutcomeType",
    "outcomeText" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "MinutesSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Resolution" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT,
    "agendaItemId" TEXT,
    "circulationId" TEXT,
    "number" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "kind" "OutcomeType" NOT NULL,
    "resultType" "ResolutionResult" NOT NULL,
    "votesYes" INTEGER,
    "votesNo" INTEGER,
    "votesAbstain" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Resolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Circulation" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "minutesId" TEXT,
    "initiatedById" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deadline" TIMESTAMP(3) NOT NULL,
    "decidedInMeetingId" TEXT,
    "status" "CirculationStatus" NOT NULL DEFAULT 'LAUFEND',
    "eligibleCount" INTEGER NOT NULL,
    "determinedById" TEXT,
    "determinedAt" TIMESTAMP(3),
    "announcedAt" TIMESTAMP(3),
    "resultText" TEXT NOT NULL DEFAULT '',
    "reportedInMeetingId" TEXT,

    CONSTRAINT "Circulation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CirculationVote" (
    "id" TEXT NOT NULL,
    "circulationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "vote" "CirculationVoteValue",
    "comment" TEXT NOT NULL DEFAULT '',
    "votedAt" TIMESTAMP(3),

    CONSTRAINT "CirculationVote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transcript" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "source" "TranscriptSource" NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL DEFAULT '',
    "filePath" TEXT,
    "text" TEXT,
    "status" "TranscriptStatus" NOT NULL DEFAULT 'HOCHGELADEN',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT NOT NULL DEFAULT '',
    "consentConfirmedById" TEXT,
    "consentConfirmedAt" TIMESTAMP(3) NOT NULL,
    "audioDeletedAt" TIMESTAMP(3),
    "textDeletedAt" TIMESTAMP(3),
    "deleteAfter" TIMESTAMP(3),
    "draft" JSONB,
    "draftCreatedAt" TIMESTAMP(3),
    "draftAppliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transcript_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Action" (
    "id" TEXT NOT NULL,
    "type" "ActionType" NOT NULL DEFAULT 'INFOSTAND',
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "location" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "partners" TEXT NOT NULL DEFAULT '',
    "status" "ActionStatus" NOT NULL DEFAULT 'GEPLANT',
    "followUpNote" TEXT NOT NULL DEFAULT '',
    "helpCallSentAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Action_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "actionId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "needed" INTEGER NOT NULL DEFAULT 2,
    "note" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftSignup" (
    "id" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftSignup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'Sonstiges',
    "district" "District" NOT NULL DEFAULT 'BEIDE',
    "status" "TopicStatus" NOT NULL DEFAULT 'NEU',
    "responsibleId" TEXT,
    "forNextMeeting" BOOLEAN NOT NULL DEFAULT false,
    "isCitizenConcern" BOOLEAN NOT NULL DEFAULT false,
    "citizenContact" TEXT,
    "citizenConsentAt" TIMESTAMP(3),
    "contactDeleteAfter" TIMESTAMP(3),
    "contactDeletedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicEvent" (
    "id" TEXT NOT NULL,
    "topicId" TEXT NOT NULL,
    "type" "TopicEventType" NOT NULL DEFAULT 'NOTIZ',
    "text" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Template" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Template_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Task_status_dueDate_idx" ON "Task"("status", "dueDate");

-- CreateIndex
CREATE INDEX "Task_meetingId_idx" ON "Task"("meetingId");

-- CreateIndex
CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Meeting_previousMeetingId_key" ON "Meeting"("previousMeetingId");

-- CreateIndex
CREATE INDEX "Meeting_startsAt_idx" ON "Meeting"("startsAt");

-- CreateIndex
CREATE INDEX "Meeting_status_idx" ON "Meeting"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AgendaItem_proposalId_key" ON "AgendaItem"("proposalId");

-- CreateIndex
CREATE INDEX "AgendaItem_meetingId_parentId_position_idx" ON "AgendaItem"("meetingId", "parentId", "position");

-- CreateIndex
CREATE INDEX "AgendaProposal_status_idx" ON "AgendaProposal"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_responseToken_key" ON "Attendance"("responseToken");

-- CreateIndex
CREATE UNIQUE INDEX "Attendance_meetingId_userId_key" ON "Attendance"("meetingId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Minutes_previousVersionId_key" ON "Minutes"("previousVersionId");

-- CreateIndex
CREATE INDEX "Minutes_meetingId_isCurrent_idx" ON "Minutes"("meetingId", "isCurrent");

-- CreateIndex
CREATE UNIQUE INDEX "MinutesSection_minutesId_agendaItemId_key" ON "MinutesSection"("minutesId", "agendaItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Resolution_circulationId_key" ON "Resolution"("circulationId");

-- CreateIndex
CREATE UNIQUE INDEX "Resolution_number_key" ON "Resolution"("number");

-- CreateIndex
CREATE INDEX "Resolution_meetingId_idx" ON "Resolution"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "Circulation_number_key" ON "Circulation"("number");

-- CreateIndex
CREATE INDEX "Circulation_status_idx" ON "Circulation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CirculationVote_token_key" ON "CirculationVote"("token");

-- CreateIndex
CREATE UNIQUE INDEX "CirculationVote_circulationId_userId_key" ON "CirculationVote"("circulationId", "userId");

-- CreateIndex
CREATE INDEX "Transcript_status_idx" ON "Transcript"("status");

-- CreateIndex
CREATE INDEX "Action_startsAt_idx" ON "Action"("startsAt");

-- CreateIndex
CREATE INDEX "Shift_actionId_startsAt_idx" ON "Shift"("actionId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftSignup_shiftId_userId_key" ON "ShiftSignup"("shiftId", "userId");

-- CreateIndex
CREATE INDEX "Topic_status_idx" ON "Topic"("status");

-- CreateIndex
CREATE INDEX "Topic_updatedAt_idx" ON "Topic"("updatedAt");

-- CreateIndex
CREATE INDEX "TopicEvent_topicId_date_idx" ON "TopicEvent"("topicId", "date");

-- CreateIndex
CREATE INDEX "Attachment_ownerType_ownerId_idx" ON "Attachment"("ownerType", "ownerId");

-- CreateIndex
CREATE INDEX "Template_key_active_idx" ON "Template"("key", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Template_key_version_key" ON "Template"("key", "version");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "AgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "Resolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_previousMeetingId_fkey" FOREIGN KEY ("previousMeetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "AgendaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_minutesToApproveId_fkey" FOREIGN KEY ("minutesToApproveId") REFERENCES "Minutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AgendaProposal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaItem" ADD CONSTRAINT "AgendaItem_carriedOverFromId_fkey" FOREIGN KEY ("carriedOverFromId") REFERENCES "AgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaProposal" ADD CONSTRAINT "AgendaProposal_proposedById_fkey" FOREIGN KEY ("proposedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgendaProposal" ADD CONSTRAINT "AgendaProposal_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSupporter" ADD CONSTRAINT "ProposalSupporter_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "AgendaProposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalSupporter" ADD CONSTRAINT "ProposalSupporter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Minutes" ADD CONSTRAINT "Minutes_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Minutes" ADD CONSTRAINT "Minutes_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "Minutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Minutes" ADD CONSTRAINT "Minutes_approvedAtMeetingId_fkey" FOREIGN KEY ("approvedAtMeetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinutesSection" ADD CONSTRAINT "MinutesSection_minutesId_fkey" FOREIGN KEY ("minutesId") REFERENCES "Minutes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MinutesSection" ADD CONSTRAINT "MinutesSection_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "AgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resolution" ADD CONSTRAINT "Resolution_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resolution" ADD CONSTRAINT "Resolution_agendaItemId_fkey" FOREIGN KEY ("agendaItemId") REFERENCES "AgendaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Resolution" ADD CONSTRAINT "Resolution_circulationId_fkey" FOREIGN KEY ("circulationId") REFERENCES "Circulation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circulation" ADD CONSTRAINT "Circulation_minutesId_fkey" FOREIGN KEY ("minutesId") REFERENCES "Minutes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circulation" ADD CONSTRAINT "Circulation_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circulation" ADD CONSTRAINT "Circulation_decidedInMeetingId_fkey" FOREIGN KEY ("decidedInMeetingId") REFERENCES "Meeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Circulation" ADD CONSTRAINT "Circulation_determinedById_fkey" FOREIGN KEY ("determinedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirculationVote" ADD CONSTRAINT "CirculationVote_circulationId_fkey" FOREIGN KEY ("circulationId") REFERENCES "Circulation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CirculationVote" ADD CONSTRAINT "CirculationVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "Meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transcript" ADD CONSTRAINT "Transcript_consentConfirmedById_fkey" FOREIGN KEY ("consentConfirmedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Action" ADD CONSTRAINT "Action_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_actionId_fkey" FOREIGN KEY ("actionId") REFERENCES "Action"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSignup" ADD CONSTRAINT "ShiftSignup_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftSignup" ADD CONSTRAINT "ShiftSignup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_responsibleId_fkey" FOREIGN KEY ("responsibleId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicEvent" ADD CONSTRAINT "TopicEvent_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicEvent" ADD CONSTRAINT "TopicEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Template" ADD CONSTRAINT "Template_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
