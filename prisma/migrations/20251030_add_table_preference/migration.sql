-- CreateTable
CREATE TABLE "TablePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tableKey" TEXT NOT NULL,
    "preferences" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TablePreference_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "TablePreference"
ADD CONSTRAINT "TablePreference_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE UNIQUE INDEX "TablePreference_userId_tableKey_key"
ON "TablePreference" ("userId", "tableKey");
