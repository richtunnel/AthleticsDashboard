-- CreateTable
CREATE TABLE "CalendarGroupMapping" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "columnName" TEXT NOT NULL,
    "columnValue" TEXT NOT NULL,
    "googleCalendarId" TEXT NOT NULL,
    "googleCalendarName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarGroupMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CalendarGroupMapping_userId_idx" ON "CalendarGroupMapping"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarGroupMapping_userId_columnName_columnValue_key" ON "CalendarGroupMapping"("userId", "columnName", "columnValue");

-- AddForeignKey
ALTER TABLE "CalendarGroupMapping" ADD CONSTRAINT "CalendarGroupMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
