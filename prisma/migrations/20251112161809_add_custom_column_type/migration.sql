-- CreateEnum
CREATE TYPE "CustomColumnType" AS ENUM ('TEXT', 'TIME', 'DROPDOWN', 'DATETIME');

-- AlterTable
ALTER TABLE "CustomColumn" ADD COLUMN "type" "CustomColumnType" NOT NULL DEFAULT 'TEXT';
