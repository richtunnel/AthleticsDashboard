-- DropIndex
DROP INDEX IF EXISTS "EmailAddress_email_key";

-- CreateIndex
CREATE UNIQUE INDEX "EmailAddress_email_groupId_key" ON "EmailAddress"("email", "groupId");

-- CreateIndex
CREATE INDEX "EmailAddress_groupId_idx" ON "EmailAddress"("groupId");
