-- AlterTable: add school district to User
ALTER TABLE "User" ADD COLUMN "schoolDistrict" TEXT;

-- AlterEnum: add SCHOOL_DISTRICT_LOOKUP to JobType
ALTER TYPE "JobType" ADD VALUE 'SCHOOL_DISTRICT_LOOKUP';
