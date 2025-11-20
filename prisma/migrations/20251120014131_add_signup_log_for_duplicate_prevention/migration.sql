-- CreateTable
CREATE TABLE "SignupLog" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "deletedUserId" TEXT,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignupLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SignupLog_email_idx" ON "SignupLog"("email");

-- CreateIndex
CREATE INDEX "SignupLog_phone_idx" ON "SignupLog"("phone");

-- CreateIndex
CREATE INDEX "SignupLog_expiresAt_idx" ON "SignupLog"("expiresAt");
