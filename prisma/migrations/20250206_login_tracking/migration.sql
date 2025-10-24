-- CreateTable
CREATE TABLE "UserLoginEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "ip" TEXT,
    "city" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserLoginEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserLoginEvent_userId_createdAt_idx" ON "UserLoginEvent"("userId", "createdAt");

-- AlterTable
ALTER TABLE "User"
    ADD COLUMN     "city" TEXT,
    ADD COLUMN     "dailyLoginCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
    ADD COLUMN     "lastLoginDate" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "UserLoginEvent"
    ADD CONSTRAINT "UserLoginEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
