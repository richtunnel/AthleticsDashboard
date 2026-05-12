-- CreateEnum
CREATE TYPE "CollaboratorChatAccess" AS ENUM ('PENDING', 'APPROVED', 'REVOKED');

-- AlterTable: add chat access fields to CollaborativeMember
ALTER TABLE "CollaborativeMember" ADD COLUMN "chatAccess" "CollaboratorChatAccess";
ALTER TABLE "CollaborativeMember" ADD COLUMN "chatAccessRequestedAt" TIMESTAMP(3);
ALTER TABLE "CollaborativeMember" ADD COLUMN "chatAccessReviewedAt" TIMESTAMP(3);
