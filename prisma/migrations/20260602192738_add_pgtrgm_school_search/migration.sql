-- Enable pg_trgm extension for fuzzy school name search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on schoolName for fast similarity queries
CREATE INDEX IF NOT EXISTS idx_user_school_name_trgm
  ON "User" USING GIN ("schoolName" gin_trgm_ops);
