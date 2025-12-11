-- DropForeignKey
ALTER TABLE "Game" DROP CONSTRAINT IF EXISTS "Game_createdById_fkey";

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
