/*
  Warnings:

  - You are about to drop the column `parentId` on the `PostComment` table. All the data in the column will be lost.
  - You are about to drop the column `parentName` on the `PostComment` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `PostLike` table. All the data in the column will be lost.
  - You are about to drop the column `parentId` on the `PostSave` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[postId,userId]` on the table `PostLike` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[postId,userId]` on the table `PostSave` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `userId` to the `PostComment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `PostLike` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `PostSave` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "PostComment_parentId_idx";

-- DropIndex
DROP INDEX "PostLike_parentId_idx";

-- DropIndex
DROP INDEX "PostLike_postId_parentId_key";

-- DropIndex
DROP INDEX "PostSave_parentId_idx";

-- DropIndex
DROP INDEX "PostSave_postId_parentId_key";

-- AlterTable
ALTER TABLE "PostComment" DROP COLUMN "parentId",
DROP COLUMN "parentName",
ADD COLUMN     "userId" TEXT NOT NULL,
ADD COLUMN     "userName" TEXT;

-- AlterTable
ALTER TABLE "PostLike" DROP COLUMN "parentId",
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PostSave" DROP COLUMN "parentId",
ADD COLUMN     "userId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "PostComment_userId_idx" ON "PostComment"("userId");

-- CreateIndex
CREATE INDEX "PostLike_userId_idx" ON "PostLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PostLike_postId_userId_key" ON "PostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "PostSave_userId_idx" ON "PostSave"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PostSave_postId_userId_key" ON "PostSave"("postId", "userId");
