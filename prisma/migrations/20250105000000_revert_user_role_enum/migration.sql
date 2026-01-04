-- Revert UserRole enum back to original 6 roles
-- This migration safely reverts the enum change

-- First, we map current values back to their closest original values
-- ADMIN -> ATHLETIC_DIRECTOR (default role)
-- MEMBER -> STAFF (closest equivalent)
UPDATE "User" SET role = 'ATHLETIC_DIRECTOR' WHERE role = 'ADMIN';
UPDATE "User" SET role = 'STAFF' WHERE role = 'MEMBER';

-- Drop the current enum type
DROP TYPE IF EXISTS "UserRole";

-- Recreate the original enum type with all 6 roles
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ATHLETIC_DIRECTOR', 'ASSISTANT_AD', 'COACH', 'STAFF', 'VENDOR_READ_ONLY');

-- Alter the column to use the restored enum type
ALTER TABLE "User" ALTER COLUMN role TYPE "UserRole" USING role::text::"UserRole";

-- Restore the default to ATHLETIC_DIRECTOR
ALTER TABLE "User" ALTER COLUMN role SET DEFAULT 'ATHLETIC_DIRECTOR';
