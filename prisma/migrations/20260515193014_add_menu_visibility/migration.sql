-- AlterTable
ALTER TABLE "User" ADD COLUMN     "hideChatMenu" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hideParentsMenu" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hidePostsMenu" BOOLEAN NOT NULL DEFAULT false;
