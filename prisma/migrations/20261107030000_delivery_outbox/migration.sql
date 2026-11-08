CREATE TABLE "DeliveryOutbox" (
  "id" TEXT PRIMARY KEY, "commandId" TEXT NOT NULL, "kind" TEXT NOT NULL, "payload" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING', "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "lockedUntil" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "sentAt" TIMESTAMPTZ, "lastError" TEXT
);
CREATE INDEX "DeliveryOutbox_status_nextAttemptAt_idx" ON "DeliveryOutbox" ("status", "nextAttemptAt");
CREATE INDEX "DeliveryOutbox_commandId_idx" ON "DeliveryOutbox" ("commandId");
