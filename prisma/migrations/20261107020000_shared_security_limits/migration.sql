CREATE TABLE "SecurityRateLimit" (
  "key" TEXT PRIMARY KEY, "attempts" INTEGER NOT NULL, "windowStartedAt" TIMESTAMPTZ NOT NULL,
  "blockedUntil" TIMESTAMPTZ, "expiresAt" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "SecurityRateLimit_expiresAt_idx" ON "SecurityRateLimit" ("expiresAt");
