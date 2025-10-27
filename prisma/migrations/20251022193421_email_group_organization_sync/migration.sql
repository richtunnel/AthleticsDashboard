-- AlterTable
ALTER TABLE "EmailGroup" ADD COLUMN     "organizationId" TEXT;

-- AddForeignKey
ALTER TABLE "EmailGroup" ADD CONSTRAINT "EmailGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
