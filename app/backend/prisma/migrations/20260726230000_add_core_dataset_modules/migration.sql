-- CreateEnum
CREATE TYPE "DatasetType" AS ENUM ('standard', 'members', 'join_requests', 'activity_registrations');

-- CreateEnum
CREATE TYPE "DatasetStatus" AS ENUM ('active', 'archived');

-- CreateEnum
CREATE TYPE "DatasetSubjectMode" AS ENUM ('none', 'single_per_user');

-- CreateEnum
CREATE TYPE "DatasetCollaboratorRole" AS ENUM ('owner', 'maintainer');

-- CreateEnum
CREATE TYPE "DatasetFieldKind" AS ENUM ('text', 'long_text', 'number', 'boolean', 'date', 'time', 'datetime', 'email', 'url', 'single_select', 'multi_select', 'json', 'relation');

-- CreateEnum
CREATE TYPE "RelationCardinality" AS ENUM ('one', 'many');

-- CreateEnum
CREATE TYPE "DatasetRowVersionOperation" AS ENUM ('create', 'update', 'delete', 'restore');

-- CreateEnum
CREATE TYPE "JoinRequestStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('draft', 'open', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "ActivityRegistrationStatus" AS ENUM ('registered', 'waitlisted', 'cancelled');

-- CreateEnum
CREATE TYPE "FormStatus" AS ENUM ('active', 'closed', 'archived');

-- CreateEnum
CREATE TYPE "FormVersionState" AS ENUM ('draft', 'published', 'retired');

-- CreateEnum
CREATE TYPE "FormSubmissionAccess" AS ENUM ('anonymous_allowed', 'authentication_required');

-- CreateEnum
CREATE TYPE "FormWriteMode" AS ENUM ('create_row', 'update_subject_row');

-- CreateEnum
CREATE TYPE "FormSubmissionOperation" AS ENUM ('created', 'updated');

-- CreateTable
CREATE TABLE "Dataset" (
    "id" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "description" TEXT,
    "type" "DatasetType" NOT NULL DEFAULT 'standard',
    "status" "DatasetStatus" NOT NULL DEFAULT 'active',
    "subjectMode" "DatasetSubjectMode" NOT NULL DEFAULT 'none',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Dataset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetCollaborator" (
    "workspaceId" INTEGER NOT NULL,
    "datasetId" TEXT NOT NULL,
    "workspaceMemberId" TEXT NOT NULL,
    "role" "DatasetCollaboratorRole" NOT NULL,
    "assignedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetCollaborator_pkey" PRIMARY KEY ("datasetId","workspaceMemberId")
);

-- CreateTable
CREATE TABLE "DatasetField" (
    "id" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "datasetId" TEXT NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "kind" "DatasetFieldKind" NOT NULL,
    "valueSchema" JSONB NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "isSystemManaged" BOOLEAN NOT NULL DEFAULT false,
    "systemKey" VARCHAR(64),
    "relationTargetDatasetId" TEXT,
    "relationCardinality" "RelationCardinality",
    "position" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "archivedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DatasetField_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetRow" (
    "id" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "datasetId" TEXT NOT NULL,
    "values" JSONB NOT NULL DEFAULT '{}',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT,
    "updatedByUserId" TEXT,
    "deletedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "DatasetRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetRelation" (
    "id" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "sourceDatasetId" TEXT NOT NULL,
    "sourceRowId" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "targetDatasetId" TEXT NOT NULL,
    "targetRowId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetRelation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetRowSubject" (
    "rowId" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "datasetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetRowSubject_pkey" PRIMARY KEY ("rowId")
);

-- CreateTable
CREATE TABLE "DatasetVersion" (
    "id" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "metadataSnapshot" JSONB NOT NULL,
    "fieldsSnapshot" JSONB NOT NULL,
    "reason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DatasetRowVersion" (
    "id" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "operation" "DatasetRowVersionOperation" NOT NULL,
    "valuesSnapshot" JSONB NOT NULL,
    "relationsSnapshot" JSONB NOT NULL,
    "changedFieldIds" TEXT[],
    "actorUserId" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DatasetRowVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembersDatasetBinding" (
    "workspaceId" INTEGER NOT NULL,
    "datasetId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembersDatasetBinding_pkey" PRIMARY KEY ("workspaceId")
);

-- CreateTable
CREATE TABLE "MemberProfileRow" (
    "workspaceMemberId" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "datasetId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "MemberProfileRow_pkey" PRIMARY KEY ("workspaceMemberId")
);

-- CreateTable
CREATE TABLE "JoinRequest" (
    "rowId" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "datasetId" TEXT NOT NULL,
    "status" "JoinRequestStatus" NOT NULL DEFAULT 'draft',
    "decidedByUserId" TEXT,
    "approvedMemberTypeId" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "decidedAt" TIMESTAMPTZ(3),
    "decisionNote" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "JoinRequest_pkey" PRIMARY KEY ("rowId")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "registrationDatasetId" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "nameI18n" JSONB NOT NULL,
    "descriptionI18n" JSONB,
    "status" "ActivityStatus" NOT NULL DEFAULT 'draft',
    "startsAt" TIMESTAMPTZ(3),
    "endsAt" TIMESTAMPTZ(3),
    "timezone" VARCHAR(64),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityRegistration" (
    "rowId" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "datasetId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "participantUserId" TEXT,
    "status" "ActivityRegistrationStatus" NOT NULL DEFAULT 'registered',
    "registeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMPTZ(3),
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ActivityRegistration_pkey" PRIMARY KEY ("rowId")
);

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "datasetId" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "status" "FormStatus" NOT NULL DEFAULT 'active',
    "activeVersionId" TEXT,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Form_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormVersion" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "state" "FormVersionState" NOT NULL DEFAULT 'draft',
    "defaultLocale" VARCHAR(35) NOT NULL,
    "nameI18n" JSONB NOT NULL,
    "descriptionI18n" JSONB,
    "closingMessageI18n" JSONB,
    "opensAt" TIMESTAMPTZ(3),
    "closesAt" TIMESTAMPTZ(3),
    "submissionAccess" "FormSubmissionAccess" NOT NULL DEFAULT 'anonymous_allowed',
    "writeMode" "FormWriteMode" NOT NULL DEFAULT 'create_row',
    "schema" JSONB NOT NULL,
    "schemaChecksum" VARCHAR(64) NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "createdByUserId" TEXT NOT NULL,
    "publishedByUserId" TEXT,
    "publishedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "FormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "formId" TEXT NOT NULL,
    "formVersionId" TEXT NOT NULL,
    "datasetId" TEXT NOT NULL,
    "rowId" TEXT NOT NULL,
    "rowVersionId" TEXT NOT NULL,
    "submitterUserId" TEXT,
    "operation" "FormSubmissionOperation" NOT NULL,
    "idempotencyKey" VARCHAR(128),
    "payloadChecksum" VARCHAR(64),
    "submittedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dataset_workspaceId_type_status_idx" ON "Dataset"("workspaceId", "type", "status");

-- CreateIndex
CREATE INDEX "Dataset_createdByUserId_idx" ON "Dataset"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_workspaceId_slug_key" ON "Dataset"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Dataset_workspaceId_id_key" ON "Dataset"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "DatasetCollaborator_workspaceId_role_idx" ON "DatasetCollaborator"("workspaceId", "role");

-- CreateIndex
CREATE INDEX "DatasetCollaborator_workspaceMemberId_idx" ON "DatasetCollaborator"("workspaceMemberId");

-- CreateIndex
CREATE INDEX "DatasetCollaborator_assignedByUserId_idx" ON "DatasetCollaborator"("assignedByUserId");

-- CreateIndex
CREATE INDEX "DatasetField_workspaceId_datasetId_position_idx" ON "DatasetField"("workspaceId", "datasetId", "position");

-- CreateIndex
CREATE INDEX "DatasetField_relationTargetDatasetId_idx" ON "DatasetField"("relationTargetDatasetId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetField_datasetId_key_key" ON "DatasetField"("datasetId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetField_datasetId_systemKey_key" ON "DatasetField"("datasetId", "systemKey");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetField_workspaceId_datasetId_id_key" ON "DatasetField"("workspaceId", "datasetId", "id");

-- CreateIndex
CREATE INDEX "DatasetRow_workspaceId_datasetId_deletedAt_createdAt_idx" ON "DatasetRow"("workspaceId", "datasetId", "deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "DatasetRow_createdByUserId_idx" ON "DatasetRow"("createdByUserId");

-- CreateIndex
CREATE INDEX "DatasetRow_updatedByUserId_idx" ON "DatasetRow"("updatedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetRow_workspaceId_datasetId_id_key" ON "DatasetRow"("workspaceId", "datasetId", "id");

-- CreateIndex
CREATE INDEX "DatasetRelation_workspaceId_targetDatasetId_targetRowId_idx" ON "DatasetRelation"("workspaceId", "targetDatasetId", "targetRowId");

-- CreateIndex
CREATE INDEX "DatasetRelation_workspaceId_sourceDatasetId_sourceRowId_fie_idx" ON "DatasetRelation"("workspaceId", "sourceDatasetId", "sourceRowId", "fieldId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetRelation_sourceRowId_fieldId_targetRowId_key" ON "DatasetRelation"("sourceRowId", "fieldId", "targetRowId");

-- CreateIndex
CREATE INDEX "DatasetRowSubject_workspaceId_userId_idx" ON "DatasetRowSubject"("workspaceId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetRowSubject_datasetId_userId_key" ON "DatasetRowSubject"("datasetId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetRowSubject_workspaceId_datasetId_rowId_key" ON "DatasetRowSubject"("workspaceId", "datasetId", "rowId");

-- CreateIndex
CREATE INDEX "DatasetVersion_createdByUserId_idx" ON "DatasetVersion"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetVersion_datasetId_version_key" ON "DatasetVersion"("datasetId", "version");

-- CreateIndex
CREATE INDEX "DatasetRowVersion_actorUserId_idx" ON "DatasetRowVersion"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DatasetRowVersion_rowId_version_key" ON "DatasetRowVersion"("rowId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "MembersDatasetBinding_datasetId_key" ON "MembersDatasetBinding"("datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "MembersDatasetBinding_workspaceId_datasetId_key" ON "MembersDatasetBinding"("workspaceId", "datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfileRow_rowId_key" ON "MemberProfileRow"("rowId");

-- CreateIndex
CREATE INDEX "MemberProfileRow_workspaceId_datasetId_idx" ON "MemberProfileRow"("workspaceId", "datasetId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfileRow_workspaceId_workspaceMemberId_key" ON "MemberProfileRow"("workspaceId", "workspaceMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberProfileRow_workspaceId_datasetId_rowId_key" ON "MemberProfileRow"("workspaceId", "datasetId", "rowId");

-- CreateIndex
CREATE INDEX "JoinRequest_workspaceId_datasetId_status_submittedAt_idx" ON "JoinRequest"("workspaceId", "datasetId", "status", "submittedAt");

-- CreateIndex
CREATE INDEX "JoinRequest_decidedByUserId_idx" ON "JoinRequest"("decidedByUserId");

-- CreateIndex
CREATE INDEX "JoinRequest_approvedMemberTypeId_idx" ON "JoinRequest"("approvedMemberTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "JoinRequest_workspaceId_datasetId_rowId_key" ON "JoinRequest"("workspaceId", "datasetId", "rowId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_registrationDatasetId_key" ON "Activity"("registrationDatasetId");

-- CreateIndex
CREATE INDEX "Activity_workspaceId_status_idx" ON "Activity"("workspaceId", "status");

-- CreateIndex
CREATE INDEX "Activity_createdByUserId_idx" ON "Activity"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_workspaceId_slug_key" ON "Activity"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_workspaceId_id_key" ON "Activity"("workspaceId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Activity_workspaceId_registrationDatasetId_key" ON "Activity"("workspaceId", "registrationDatasetId");

-- CreateIndex
CREATE INDEX "ActivityRegistration_workspaceId_activityId_status_register_idx" ON "ActivityRegistration"("workspaceId", "activityId", "status", "registeredAt");

-- CreateIndex
CREATE INDEX "ActivityRegistration_participantUserId_idx" ON "ActivityRegistration"("participantUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRegistration_workspaceId_datasetId_rowId_key" ON "ActivityRegistration"("workspaceId", "datasetId", "rowId");

-- CreateIndex
CREATE UNIQUE INDEX "Form_activeVersionId_key" ON "Form"("activeVersionId");

-- CreateIndex
CREATE INDEX "Form_workspaceId_datasetId_status_idx" ON "Form"("workspaceId", "datasetId", "status");

-- CreateIndex
CREATE INDEX "Form_createdByUserId_idx" ON "Form"("createdByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Form_workspaceId_slug_key" ON "Form"("workspaceId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Form_workspaceId_id_key" ON "Form"("workspaceId", "id");

-- CreateIndex
CREATE INDEX "FormVersion_formId_state_idx" ON "FormVersion"("formId", "state");

-- CreateIndex
CREATE INDEX "FormVersion_createdByUserId_idx" ON "FormVersion"("createdByUserId");

-- CreateIndex
CREATE INDEX "FormVersion_publishedByUserId_idx" ON "FormVersion"("publishedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FormVersion_formId_version_key" ON "FormVersion"("formId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "FormSubmission_rowVersionId_key" ON "FormSubmission"("rowVersionId");

-- CreateIndex
CREATE INDEX "FormSubmission_workspaceId_datasetId_submittedAt_idx" ON "FormSubmission"("workspaceId", "datasetId", "submittedAt");

-- CreateIndex
CREATE INDEX "FormSubmission_formVersionId_idx" ON "FormSubmission"("formVersionId");

-- CreateIndex
CREATE INDEX "FormSubmission_rowId_idx" ON "FormSubmission"("rowId");

-- CreateIndex
CREATE INDEX "FormSubmission_submitterUserId_idx" ON "FormSubmission"("submitterUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FormSubmission_formId_idempotencyKey_key" ON "FormSubmission"("formId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_id_key" ON "WorkspaceMember"("workspaceId", "id");

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetCollaborator" ADD CONSTRAINT "DatasetCollaborator_workspaceId_datasetId_fkey" FOREIGN KEY ("workspaceId", "datasetId") REFERENCES "Dataset"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetCollaborator" ADD CONSTRAINT "DatasetCollaborator_workspaceId_workspaceMemberId_fkey" FOREIGN KEY ("workspaceId", "workspaceMemberId") REFERENCES "WorkspaceMember"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetCollaborator" ADD CONSTRAINT "DatasetCollaborator_assignedByUserId_fkey" FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetField" ADD CONSTRAINT "DatasetField_workspaceId_datasetId_fkey" FOREIGN KEY ("workspaceId", "datasetId") REFERENCES "Dataset"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetField" ADD CONSTRAINT "DatasetField_workspaceId_relationTargetDatasetId_fkey" FOREIGN KEY ("workspaceId", "relationTargetDatasetId") REFERENCES "Dataset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRow" ADD CONSTRAINT "DatasetRow_workspaceId_datasetId_fkey" FOREIGN KEY ("workspaceId", "datasetId") REFERENCES "Dataset"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRow" ADD CONSTRAINT "DatasetRow_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRow" ADD CONSTRAINT "DatasetRow_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRelation" ADD CONSTRAINT "DatasetRelation_workspaceId_sourceDatasetId_sourceRowId_fkey" FOREIGN KEY ("workspaceId", "sourceDatasetId", "sourceRowId") REFERENCES "DatasetRow"("workspaceId", "datasetId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRelation" ADD CONSTRAINT "DatasetRelation_workspaceId_targetDatasetId_targetRowId_fkey" FOREIGN KEY ("workspaceId", "targetDatasetId", "targetRowId") REFERENCES "DatasetRow"("workspaceId", "datasetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRelation" ADD CONSTRAINT "DatasetRelation_workspaceId_sourceDatasetId_fieldId_fkey" FOREIGN KEY ("workspaceId", "sourceDatasetId", "fieldId") REFERENCES "DatasetField"("workspaceId", "datasetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRowSubject" ADD CONSTRAINT "DatasetRowSubject_workspaceId_datasetId_rowId_fkey" FOREIGN KEY ("workspaceId", "datasetId", "rowId") REFERENCES "DatasetRow"("workspaceId", "datasetId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRowSubject" ADD CONSTRAINT "DatasetRowSubject_workspaceId_datasetId_fkey" FOREIGN KEY ("workspaceId", "datasetId") REFERENCES "Dataset"("workspaceId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRowSubject" ADD CONSTRAINT "DatasetRowSubject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetVersion" ADD CONSTRAINT "DatasetVersion_datasetId_fkey" FOREIGN KEY ("datasetId") REFERENCES "Dataset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetVersion" ADD CONSTRAINT "DatasetVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRowVersion" ADD CONSTRAINT "DatasetRowVersion_rowId_fkey" FOREIGN KEY ("rowId") REFERENCES "DatasetRow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DatasetRowVersion" ADD CONSTRAINT "DatasetRowVersion_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembersDatasetBinding" ADD CONSTRAINT "MembersDatasetBinding_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembersDatasetBinding" ADD CONSTRAINT "MembersDatasetBinding_workspaceId_datasetId_fkey" FOREIGN KEY ("workspaceId", "datasetId") REFERENCES "Dataset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProfileRow" ADD CONSTRAINT "MemberProfileRow_workspaceId_workspaceMemberId_fkey" FOREIGN KEY ("workspaceId", "workspaceMemberId") REFERENCES "WorkspaceMember"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProfileRow" ADD CONSTRAINT "MemberProfileRow_workspaceId_datasetId_fkey" FOREIGN KEY ("workspaceId", "datasetId") REFERENCES "Dataset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberProfileRow" ADD CONSTRAINT "MemberProfileRow_workspaceId_datasetId_rowId_fkey" FOREIGN KEY ("workspaceId", "datasetId", "rowId") REFERENCES "DatasetRow"("workspaceId", "datasetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_workspaceId_datasetId_rowId_fkey" FOREIGN KEY ("workspaceId", "datasetId", "rowId") REFERENCES "DatasetRow"("workspaceId", "datasetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_workspaceId_datasetId_fkey" FOREIGN KEY ("workspaceId", "datasetId") REFERENCES "Dataset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_approvedMemberTypeId_fkey" FOREIGN KEY ("approvedMemberTypeId") REFERENCES "WorkspaceMemberType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_workspaceId_registrationDatasetId_fkey" FOREIGN KEY ("workspaceId", "registrationDatasetId") REFERENCES "Dataset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRegistration" ADD CONSTRAINT "ActivityRegistration_workspaceId_datasetId_rowId_fkey" FOREIGN KEY ("workspaceId", "datasetId", "rowId") REFERENCES "DatasetRow"("workspaceId", "datasetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRegistration" ADD CONSTRAINT "ActivityRegistration_workspaceId_datasetId_fkey" FOREIGN KEY ("workspaceId", "datasetId") REFERENCES "Dataset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRegistration" ADD CONSTRAINT "ActivityRegistration_workspaceId_activityId_fkey" FOREIGN KEY ("workspaceId", "activityId") REFERENCES "Activity"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRegistration" ADD CONSTRAINT "ActivityRegistration_participantUserId_fkey" FOREIGN KEY ("participantUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_workspaceId_datasetId_fkey" FOREIGN KEY ("workspaceId", "datasetId") REFERENCES "Dataset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_activeVersionId_fkey" FOREIGN KEY ("activeVersionId") REFERENCES "FormVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Form" ADD CONSTRAINT "Form_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_publishedByUserId_fkey" FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_workspaceId_formId_fkey" FOREIGN KEY ("workspaceId", "formId") REFERENCES "Form"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_workspaceId_datasetId_fkey" FOREIGN KEY ("workspaceId", "datasetId") REFERENCES "Dataset"("workspaceId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_workspaceId_datasetId_rowId_fkey" FOREIGN KEY ("workspaceId", "datasetId", "rowId") REFERENCES "DatasetRow"("workspaceId", "datasetId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_rowVersionId_fkey" FOREIGN KEY ("rowVersionId") REFERENCES "DatasetRowVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_submitterUserId_fkey" FOREIGN KEY ("submitterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddCheckConstraints
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_revision_check" CHECK ("revision" > 0);
ALTER TABLE "Dataset" ADD CONSTRAINT "Dataset_special_subject_mode_check" CHECK (
    "type" NOT IN ('members', 'join_requests') OR "subjectMode" = 'single_per_user'
);
ALTER TABLE "DatasetField" ADD CONSTRAINT "DatasetField_revision_position_check" CHECK (
    "revision" > 0 AND "position" >= 0
);
ALTER TABLE "DatasetField" ADD CONSTRAINT "DatasetField_relation_metadata_check" CHECK (
    ("kind" = 'relation' AND "relationTargetDatasetId" IS NOT NULL AND "relationCardinality" IS NOT NULL)
    OR
    ("kind" <> 'relation' AND "relationTargetDatasetId" IS NULL AND "relationCardinality" IS NULL)
);
ALTER TABLE "DatasetField" ADD CONSTRAINT "DatasetField_system_key_check" CHECK (
    "isSystemManaged" = ("systemKey" IS NOT NULL)
);
ALTER TABLE "DatasetRow" ADD CONSTRAINT "DatasetRow_revision_check" CHECK ("revision" > 0);
ALTER TABLE "DatasetRelation" ADD CONSTRAINT "DatasetRelation_position_check" CHECK ("position" >= 0);
ALTER TABLE "DatasetVersion" ADD CONSTRAINT "DatasetVersion_version_check" CHECK ("version" > 0);
ALTER TABLE "DatasetRowVersion" ADD CONSTRAINT "DatasetRowVersion_version_check" CHECK ("version" > 0);
ALTER TABLE "JoinRequest" ADD CONSTRAINT "JoinRequest_revision_check" CHECK ("revision" > 0);
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_revision_time_check" CHECK (
    "revision" > 0 AND ("startsAt" IS NULL OR "endsAt" IS NULL OR "endsAt" > "startsAt")
);
ALTER TABLE "ActivityRegistration" ADD CONSTRAINT "ActivityRegistration_revision_check" CHECK (
    "revision" > 0
);
ALTER TABLE "Form" ADD CONSTRAINT "Form_revision_check" CHECK ("revision" > 0);
ALTER TABLE "FormVersion" ADD CONSTRAINT "FormVersion_revision_time_check" CHECK (
    "version" > 0 AND "revision" > 0
    AND ("opensAt" IS NULL OR "closesAt" IS NULL OR "closesAt" > "opensAt")
);
ALTER TABLE "FormSubmission" ADD CONSTRAINT "FormSubmission_idempotency_check" CHECK (
    ("idempotencyKey" IS NULL) = ("payloadChecksum" IS NULL)
);

-- Backfill one Members Dataset and its protected fields per existing Workspace.
INSERT INTO "Dataset" (
    "id", "workspaceId", "name", "slug", "description", "type", "status",
    "subjectMode", "revision", "createdByUserId", "createdAt", "updatedAt"
)
SELECT
    'sys_members_dataset_' || w."id",
    w."id",
    'Members',
    'members',
    'Workspace member profile extensions',
    'members'::"DatasetType",
    'active'::"DatasetStatus",
    'single_per_user'::"DatasetSubjectMode",
    1,
    w."ownerUserId",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Workspace" w;

INSERT INTO "DatasetCollaborator" (
    "workspaceId", "datasetId", "workspaceMemberId", "role", "assignedByUserId", "createdAt"
)
SELECT
    w."id",
    'sys_members_dataset_' || w."id",
    wm."id",
    'owner'::"DatasetCollaboratorRole",
    w."ownerUserId",
    CURRENT_TIMESTAMP
FROM "Workspace" w
JOIN "WorkspaceMember" wm
    ON wm."workspaceId" = w."id" AND wm."userId" = w."ownerUserId";

INSERT INTO "DatasetField" (
    "id", "workspaceId", "datasetId", "key", "name", "kind", "valueSchema", "config",
    "required", "isSystemManaged", "systemKey", "position", "revision", "createdAt", "updatedAt"
)
SELECT
    field."idPrefix" || w."id",
    w."id",
    'sys_members_dataset_' || w."id",
    field."key",
    field."name",
    field."kind"::"DatasetFieldKind",
    field."valueSchema",
    '{}'::jsonb,
    true,
    true,
    field."systemKey",
    field."position",
    1,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Workspace" w
CROSS JOIN (
    VALUES
        ('sys_members_field_user_', 'member_user', 'User ID', 'text', '{"type":"string","minLength":1}'::jsonb, 'member_user', 0),
        ('sys_members_field_name_', 'member_name', 'Name', 'text', '{"type":"string","minLength":1,"maxLength":128}'::jsonb, 'member_name', 1),
        ('sys_members_field_email_', 'member_email', 'Email', 'email', '{"type":"string","format":"email","maxLength":320}'::jsonb, 'member_email', 2),
        ('sys_members_field_type_', 'member_type', 'Member type', 'text', '{"type":"string","minLength":1,"maxLength":64}'::jsonb, 'member_type', 3),
        ('sys_members_field_status_', 'member_status', 'Member status', 'text', '{"type":"string","enum":["pending","active","suspended","removed"]}'::jsonb, 'member_status', 4)
) AS field("idPrefix", "key", "name", "kind", "valueSchema", "systemKey", "position");

INSERT INTO "MembersDatasetBinding" ("workspaceId", "datasetId", "createdAt")
SELECT w."id", 'sys_members_dataset_' || w."id", CURRENT_TIMESTAMP
FROM "Workspace" w;

INSERT INTO "DatasetRow" (
    "id", "workspaceId", "datasetId", "values", "revision", "createdByUserId",
    "updatedByUserId", "deletedAt", "createdAt", "updatedAt"
)
SELECT
    'sys_member_row_' || wm."id",
    wm."workspaceId",
    'sys_members_dataset_' || wm."workspaceId",
    jsonb_build_object(
        'sys_members_field_user_' || wm."workspaceId", wm."userId",
        'sys_members_field_name_' || wm."workspaceId", u."name",
        'sys_members_field_email_' || wm."workspaceId", u."email",
        'sys_members_field_type_' || wm."workspaceId", mt."slug",
        'sys_members_field_status_' || wm."workspaceId", wm."status"::text
    ),
    1,
    NULL,
    NULL,
    CASE WHEN wm."status" = 'removed' THEN CURRENT_TIMESTAMP ELSE NULL END,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "WorkspaceMember" wm
JOIN "WorkspaceMemberType" mt ON mt."id" = wm."memberTypeId"
JOIN "User" u ON u."id" = wm."userId"
WHERE mt."slug" <> 'guest';

INSERT INTO "DatasetRowSubject" ("rowId", "workspaceId", "datasetId", "userId", "createdAt")
SELECT
    'sys_member_row_' || wm."id",
    wm."workspaceId",
    'sys_members_dataset_' || wm."workspaceId",
    wm."userId",
    CURRENT_TIMESTAMP
FROM "WorkspaceMember" wm
JOIN "WorkspaceMemberType" mt ON mt."id" = wm."memberTypeId"
WHERE mt."slug" <> 'guest';

INSERT INTO "MemberProfileRow" (
    "workspaceMemberId", "workspaceId", "datasetId", "rowId", "createdAt", "updatedAt"
)
SELECT
    wm."id",
    wm."workspaceId",
    'sys_members_dataset_' || wm."workspaceId",
    'sys_member_row_' || wm."id",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "WorkspaceMember" wm
JOIN "WorkspaceMemberType" mt ON mt."id" = wm."memberTypeId"
WHERE mt."slug" <> 'guest';

INSERT INTO "DatasetRowVersion" (
    "id", "rowId", "version", "operation", "valuesSnapshot", "relationsSnapshot",
    "changedFieldIds", "actorUserId", "createdAt"
)
SELECT
    'sys_member_row_version_' || wm."id",
    'sys_member_row_' || wm."id",
    1,
    'create'::"DatasetRowVersionOperation",
    row."values",
    '{}'::jsonb,
    ARRAY[
        'sys_members_field_user_' || wm."workspaceId",
        'sys_members_field_name_' || wm."workspaceId",
        'sys_members_field_email_' || wm."workspaceId",
        'sys_members_field_type_' || wm."workspaceId",
        'sys_members_field_status_' || wm."workspaceId"
    ],
    NULL,
    CURRENT_TIMESTAMP
FROM "WorkspaceMember" wm
JOIN "WorkspaceMemberType" mt ON mt."id" = wm."memberTypeId"
JOIN "DatasetRow" row ON row."id" = 'sys_member_row_' || wm."id"
WHERE mt."slug" <> 'guest';

INSERT INTO "DatasetVersion" (
    "id", "datasetId", "version", "metadataSnapshot", "fieldsSnapshot",
    "reason", "createdByUserId", "createdAt"
)
SELECT
    'sys_members_dataset_version_' || w."id",
    'sys_members_dataset_' || w."id",
    1,
    jsonb_build_object(
        'name', 'Members',
        'slug', 'members',
        'type', 'members',
        'subjectMode', 'single_per_user'
    ),
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'id', f."id",
                'key', f."key",
                'name', f."name",
                'kind', f."kind"::text,
                'valueSchema', f."valueSchema",
                'required', f."required",
                'isSystemManaged', f."isSystemManaged",
                'systemKey', f."systemKey",
                'position', f."position",
                'revision', f."revision"
            ) ORDER BY f."position"
        )
        FROM "DatasetField" f
        WHERE f."datasetId" = 'sys_members_dataset_' || w."id"
    ),
    'Initialize Members Dataset',
    w."ownerUserId",
    CURRENT_TIMESTAMP
FROM "Workspace" w;

INSERT INTO "AuditLog" (
    "workspaceId", "actorUserId", "actorType", "action", "resourceType",
    "resourceId", "result", "metadata", "createdAt"
)
SELECT
    w."id",
    NULL,
    'system',
    'dataset.members.initialize',
    'dataset',
    'sys_members_dataset_' || w."id",
    'success',
    jsonb_build_object('source', 'migration'),
    CURRENT_TIMESTAMP
FROM "Workspace" w;
