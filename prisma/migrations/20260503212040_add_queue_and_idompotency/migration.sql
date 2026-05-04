-- CreateIndex
CREATE INDEX "BackgroundJob_status_createdAt_idx" ON "BackgroundJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BackgroundJob_payload_idx" ON "BackgroundJob"("payload");
