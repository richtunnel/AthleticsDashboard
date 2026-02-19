-- CreateEnum
CREATE TYPE "CollaborativeRole" AS ENUM ('VIEWER', 'MEMBER');

-- CreateEnum
CREATE TYPE "CollaborativeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "CollaborationAction" AS ENUM ('INVITE_CREATED', 'INVITE_ACCEPTED', 'INVITE_EXPIRED', 'MEMBER_REVOKED');

-- CreateTable
CREATE TABLE "CollaborativeMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "CollaborativeRole" NOT NULL DEFAULT 'VIEWER',
    "status" "CollaborativeStatus" NOT NULL DEFAULT 'PENDING',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokeReason" TEXT,
    "token" TEXT,

    CONSTRAINT "CollaborativeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CollaborationAuditLog" (
    "id" TEXT NOT NULL,
    "action" "CollaborationAction" NOT NULL,
    "ownerId" TEXT NOT NULL,
    "targetEmail" TEXT,
    "collaboratorId" TEXT,
    "role" "CollaborativeRole",
    "details" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollaborationAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CollaborativeMember_token_key" ON "CollaborativeMember"("token");

-- CreateIndex
CREATE INDEX "CollaborativeMember_userId_status_idx" ON "CollaborativeMember"("userId", "status");

-- CreateIndex
CREATE INDEX "CollaborativeMember_email_idx" ON "CollaborativeMember"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CollaborativeMember_userId_email_key" ON "CollaborativeMember"("userId", "email");

-- CreateIndex
CREATE INDEX "CollaborationAuditLog_ownerId_createdAt_idx" ON "CollaborationAuditLog"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "CollaborationAuditLog_action_createdAt_idx" ON "CollaborationAuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "CollaborativeMember" ADD CONSTRAINT "CollaborativeMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
