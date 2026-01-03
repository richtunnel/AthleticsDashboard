-- Migration: 20260103164807_member_role_assignment_part1
-- This migration ONLY adds the MEMBER enum value

-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'MEMBER';