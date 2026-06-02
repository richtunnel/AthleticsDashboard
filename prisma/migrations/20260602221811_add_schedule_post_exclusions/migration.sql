-- AlterTable
ALTER TABLE "SchedulePost" ADD COLUMN     "excludeWeekends" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "excludedDates" JSONB NOT NULL DEFAULT '[]';
