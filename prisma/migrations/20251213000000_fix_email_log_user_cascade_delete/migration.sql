-- DropForeignKey
ALTER TABLE "EmailLog" DROP CONSTRAINT IF EXISTS "EmailLog_sentById_fkey";

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
