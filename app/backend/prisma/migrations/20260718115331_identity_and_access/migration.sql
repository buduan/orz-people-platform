-- CreateEnum
CREATE TYPE "FormGrantRole" AS ENUM ('owner', 'editor', 'reviewer', 'viewer');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" TEXT,
    "banned" BOOLEAN DEFAULT false,
    "banReason" TEXT,
    "banExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "impersonatedBy" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passkey" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "publicKey" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "credentialID" TEXT NOT NULL,
    "counter" INTEGER NOT NULL,
    "deviceType" TEXT NOT NULL,
    "backedUp" BOOLEAN NOT NULL,
    "transports" TEXT,
    "aaguid" TEXT,
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "memberSourceFormId" TEXT,
    "memberSourceFieldId" TEXT,
    "memberOptionCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "memberProjectionEpoch" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_user" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isMember" BOOLEAN NOT NULL DEFAULT false,
    "disabled" BOOLEAN NOT NULL DEFAULT false,
    "permissionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permission_definition" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "scope" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permission_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_permission_grant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceUserId" TEXT NOT NULL,
    "permissionKey" TEXT NOT NULL,
    "grantedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workspace_permission_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "form_grant" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "workspaceUserId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "role" "FormGrantRole" NOT NULL,
    "grantedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "form_grant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_definition" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_group_definition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_group_membership" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "workspaceUserId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_group_membership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "passkey_userId_idx" ON "passkey"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_slug_key" ON "workspace"("slug");

-- CreateIndex
CREATE INDEX "workspace_user_workspaceId_idx" ON "workspace_user"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_user_workspaceId_isMember_idx" ON "workspace_user"("workspaceId", "isMember");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_user_workspaceId_userId_key" ON "workspace_user"("workspaceId", "userId");

-- CreateIndex
CREATE INDEX "permission_definition_workspaceId_idx" ON "permission_definition"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "permission_definition_workspaceId_key_key" ON "permission_definition"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "workspace_permission_grant_workspaceId_idx" ON "workspace_permission_grant"("workspaceId");

-- CreateIndex
CREATE INDEX "workspace_permission_grant_workspaceUserId_idx" ON "workspace_permission_grant"("workspaceUserId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_permission_grant_workspaceId_workspaceUserId_perm_key" ON "workspace_permission_grant"("workspaceId", "workspaceUserId", "permissionKey");

-- CreateIndex
CREATE INDEX "form_grant_workspaceId_formId_idx" ON "form_grant"("workspaceId", "formId");

-- CreateIndex
CREATE INDEX "form_grant_workspaceUserId_idx" ON "form_grant"("workspaceUserId");

-- CreateIndex
CREATE UNIQUE INDEX "form_grant_workspaceId_formId_workspaceUserId_role_key" ON "form_grant"("workspaceId", "formId", "workspaceUserId", "role");

-- CreateIndex
CREATE INDEX "user_group_definition_workspaceId_idx" ON "user_group_definition"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_definition_workspaceId_key_key" ON "user_group_definition"("workspaceId", "key");

-- CreateIndex
CREATE INDEX "user_group_membership_workspaceId_idx" ON "user_group_membership"("workspaceId");

-- CreateIndex
CREATE INDEX "user_group_membership_workspaceUserId_idx" ON "user_group_membership"("workspaceUserId");

-- CreateIndex
CREATE UNIQUE INDEX "user_group_membership_groupId_workspaceUserId_key" ON "user_group_membership"("groupId", "workspaceUserId");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passkey" ADD CONSTRAINT "passkey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_user" ADD CONSTRAINT "workspace_user_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_user" ADD CONSTRAINT "workspace_user_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_permission_grant" ADD CONSTRAINT "workspace_permission_grant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_permission_grant" ADD CONSTRAINT "workspace_permission_grant_workspaceUserId_fkey" FOREIGN KEY ("workspaceUserId") REFERENCES "workspace_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_grant" ADD CONSTRAINT "form_grant_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "form_grant" ADD CONSTRAINT "form_grant_workspaceUserId_fkey" FOREIGN KEY ("workspaceUserId") REFERENCES "workspace_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_definition" ADD CONSTRAINT "user_group_definition_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_membership" ADD CONSTRAINT "user_group_membership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "user_group_definition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_membership" ADD CONSTRAINT "user_group_membership_workspaceUserId_fkey" FOREIGN KEY ("workspaceUserId") REFERENCES "workspace_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_group_membership" ADD CONSTRAINT "user_group_membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
