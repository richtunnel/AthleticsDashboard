-- CreateTable
CREATE TABLE "AccountDeletionReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "daysBeforeDeletion" INTEGER NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountDeletionReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountDeletionReminder_userId_daysBeforeDeletion_key" ON "AccountDeletionReminder"("userId", "daysBeforeDeletion");

-- CreateIndex
CREATE INDEX "AccountDeletionReminder_daysBeforeDeletion_idx" ON "AccountDeletionReminder"("daysBeforeDeletion");

-- AddForeignKey
ALTER TABLE "AccountDeletionReminder"
  ADD CONSTRAINT "AccountDeletionReminder_userId_fkey" FOREIGN KEY ("userId")
  REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "User" ADD COLUMN "deletionScheduledAt" TIMESTAMP(3);
