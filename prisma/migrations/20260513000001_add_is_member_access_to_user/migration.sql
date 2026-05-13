-- Add isMemberAccess flag to User.
-- This is the canonical source of truth for identifying temporary member/test
-- accounts created via the vip.opletics.com product-testing flow.
-- Existing rows default to FALSE (not a member access account).
ALTER TABLE "User" ADD COLUMN "isMemberAccess" BOOLEAN NOT NULL DEFAULT FALSE;
