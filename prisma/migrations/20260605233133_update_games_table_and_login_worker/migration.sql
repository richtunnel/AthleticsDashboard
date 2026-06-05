-- CreateIndex
CREATE INDEX "EmailLog_status_sentAt_idx" ON "EmailLog"("status", "sentAt");

-- CreateIndex
CREATE INDEX "EmailLog_sentById_status_sentAt_idx" ON "EmailLog"("sentById", "status", "sentAt");

-- CreateIndex
CREATE INDEX "Game_workbookId_date_idx" ON "Game"("workbookId", "date");

-- CreateIndex
CREATE INDEX "Game_workbookId_status_idx" ON "Game"("workbookId", "status");

-- CreateIndex
CREATE INDEX "Game_date_status_idx" ON "Game"("date", "status");

-- CreateIndex
CREATE INDEX "Game_homeTeamId_date_idx" ON "Game"("homeTeamId", "date");
