-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "cost" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "costBudgetEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "monthlyBudget" DOUBLE PRECISION;
