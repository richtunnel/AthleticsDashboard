BEGIN;

-- 1) Add new temporary text column (nullable to be safe)
ALTER TABLE "Team" ADD COLUMN "level_new" text;

-- 2) Copy enum values into text column
-- If your enum stored textual values, this casts enum to text.
UPDATE "Team" SET "level_new" = "level"::text;

-- 3) (Optional) If you want to set a fallback for any NULLs produced:
-- UPDATE "Team" SET "level_new" = 'VARSITY' WHERE "level_new" IS NULL AND "level" IS NOT NULL;

-- 4) Make sure level_new has no NULLs if column should be NOT NULL
-- If you want level to remain required, ensure this passes:
-- SELECT COUNT(*) FROM "Team" WHERE "level_new" IS NULL;

-- 5) Drop the old enum column
ALTER TABLE "Team" DROP COLUMN "level";

-- 6) Rename level_new -> level
ALTER TABLE "Team" RENAME COLUMN "level_new" TO "level";

-- 7) If you require NOT NULL, set NOT NULL now (only if step 4 confirmed no NULLs)
ALTER TABLE "Team" ALTER COLUMN "level" SET NOT NULL;

-- 8) Optionally drop the enum type if nothing else uses it.
-- Be careful: only drop if no other tables use the type.
-- DROP TYPE IF EXISTS "TeamLevel";

COMMIT;


