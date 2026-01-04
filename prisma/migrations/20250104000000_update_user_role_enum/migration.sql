-- Update UserRole enum to only have ADMIN and MEMBER
-- This migration handles the enum change safely

-- First, we need to update any existing user roles to valid values
UPDATE "User" SET role = 'ADMIN' WHERE role IN ('SUPER_ADMIN', 'ATHLETIC_DIRECTOR', 'ASSISTANT_AD', 'COACH', 'STAFF', 'VENDOR_READ_ONLY');
UPDATE "User" SET role = 'MEMBER' WHERE role NOT IN ('ADMIN', 'MEMBER');

-- Drop the old enum type
DROP TYPE IF EXISTS "UserRole";

-- Create the new enum type with only ADMIN and MEMBER
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- Alter the column to use the new enum type
ALTER TABLE "User" ALTER COLUMN role TYPE "UserRole" USING role::text::"UserRole";

-- Ensure the default is set correctly
ALTER TABLE "User" ALTER COLUMN role SET DEFAULT 'ADMIN';