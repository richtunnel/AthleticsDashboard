/*
  Warnings:

  - A unique constraint covering the columns `[schoolEmail]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "schoolEmail" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_schoolEmail_key" ON "User"("schoolEmail");
