-- Existing users have no trustworthy source for the required personal name.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM "User" LIMIT 1) THEN
        RAISE EXCEPTION 'User name migration stopped: existing User rows require an explicit name mapping before this migration can run.';
    END IF;
END $$;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "name" VARCHAR(128) NOT NULL;

-- CreateTable
CREATE TABLE "WorkspaceMemberType" (
    "id" TEXT NOT NULL,
    "workspaceId" INTEGER NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceMemberType_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "WorkspaceMember" ADD COLUMN "memberTypeId" TEXT;

-- Seed required member types for each existing Workspace.
INSERT INTO "WorkspaceMemberType" ("id", "workspaceId", "name", "slug", "isSystem", "createdAt", "updatedAt")
SELECT 'system-member-type-' || "id", "id", 'Member', 'member', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Workspace";

INSERT INTO "WorkspaceMemberType" ("id", "workspaceId", "name", "slug", "isSystem", "createdAt", "updatedAt")
SELECT 'system-guest-type-' || "id", "id", 'Guest', 'guest', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Workspace";

UPDATE "WorkspaceMember" AS member
SET "memberTypeId" = member_type."id"
FROM "WorkspaceMemberType" AS member_type
WHERE member_type."workspaceId" = member."workspaceId"
  AND member_type."slug" = 'guest';

ALTER TABLE "WorkspaceMember" ALTER COLUMN "memberTypeId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "WorkspaceMember_memberTypeId_idx" ON "WorkspaceMember"("memberTypeId");
CREATE INDEX "WorkspaceMemberType_workspaceId_idx" ON "WorkspaceMemberType"("workspaceId");
CREATE UNIQUE INDEX "WorkspaceMemberType_workspaceId_slug_key" ON "WorkspaceMemberType"("workspaceId", "slug");

-- AddForeignKey
ALTER TABLE "WorkspaceMember" ADD CONSTRAINT "WorkspaceMember_memberTypeId_fkey" FOREIGN KEY ("memberTypeId") REFERENCES "WorkspaceMemberType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMemberType" ADD CONSTRAINT "WorkspaceMemberType_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
