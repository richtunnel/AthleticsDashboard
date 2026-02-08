-- AlterTable
ALTER TABLE "EmailLog" ADD COLUMN     "selectedSchoolNames" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "visibleColumnIds" TEXT[] DEFAULT ARRAY[]::TEXT[];
