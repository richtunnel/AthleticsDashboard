-- CreateTable
CREATE TABLE "ParentGameCalendarEvent" (
    "id" TEXT NOT NULL,
    "parentUserId" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "googleCalendarEventId" TEXT NOT NULL,
    "googleCalendarId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParentGameCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParentGameCalendarEvent_parentUserId_idx" ON "ParentGameCalendarEvent"("parentUserId");

-- CreateIndex
CREATE INDEX "ParentGameCalendarEvent_gameId_idx" ON "ParentGameCalendarEvent"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "ParentGameCalendarEvent_parentUserId_gameId_key" ON "ParentGameCalendarEvent"("parentUserId", "gameId");
