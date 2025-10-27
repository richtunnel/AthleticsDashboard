-- AlterTable
ALTER TABLE "EmailLog" ALTER COLUMN "sentById" DROP NOT NULL;

-- DropForeignKey
ALTER TABLE "EmailLog" DROP CONSTRAINT "EmailLog_sentById_fkey";

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
