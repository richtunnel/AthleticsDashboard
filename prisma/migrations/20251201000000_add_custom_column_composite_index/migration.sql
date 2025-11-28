-- CreateIndex
CREATE INDEX "CustomColumn_organizationId_idx" ON "CustomColumn"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomColumn_organizationId_name_key" ON "CustomColumn"("organizationId", "name");
