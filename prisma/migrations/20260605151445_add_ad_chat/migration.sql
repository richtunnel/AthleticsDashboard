-- CreateEnum
CREATE TYPE "AdConvStatus" AS ENUM ('PENDING', 'ACTIVE', 'BLOCKED');

-- CreateTable
CREATE TABLE "AdConversation" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "status" "AdConvStatus" NOT NULL DEFAULT 'PENDING',
    "blockedByUserId" TEXT,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdMessage" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdConversation_userAId_idx" ON "AdConversation"("userAId");

-- CreateIndex
CREATE INDEX "AdConversation_userBId_idx" ON "AdConversation"("userBId");

-- CreateIndex
CREATE INDEX "AdConversation_lastMessageAt_idx" ON "AdConversation"("lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "AdConversation_userAId_userBId_key" ON "AdConversation"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "AdMessage_conversationId_createdAt_idx" ON "AdMessage"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "AdMessage_senderUserId_idx" ON "AdMessage"("senderUserId");

-- AddForeignKey
ALTER TABLE "AdConversation" ADD CONSTRAINT "AdConversation_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdConversation" ADD CONSTRAINT "AdConversation_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMessage" ADD CONSTRAINT "AdMessage_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "AdConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdMessage" ADD CONSTRAINT "AdMessage_senderUserId_fkey" FOREIGN KEY ("senderUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
