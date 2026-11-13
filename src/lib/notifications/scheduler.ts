import { buildAndSendGmdMorningDigest } from "@/lib/notifications/morning-digest";

declare global {
  // eslint-disable-next-line no-var
  var __bemsMorningDigestTimerStarted: boolean | undefined;
}

/**
 * Starts an in-process 15-minute check that automatically dispatches
 * the GMD Morning Digest at or after 08:00 Africa/Lagos (WAT) once per day.
 */
export function ensureMorningDigestSchedulerStarted() {
  if (globalThis.__bemsMorningDigestTimerStarted) return;
  globalThis.__bemsMorningDigestTimerStarted = true;

  const checkAndSend = async () => {
    try {
      const hourStr = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Africa/Lagos",
        hour: "2-digit",
        hour12: false,
      }).format(new Date());
      const lagosHour = parseInt(hourStr, 10);
      if (!Number.isNaN(lagosHour) && lagosHour >= 8) {
        await buildAndSendGmdMorningDigest({ force: false });
      }
    } catch (err) {
      console.error("[MorningDigest Scheduler] Check failed:", err);
    }
  };

  setInterval(checkAndSend, 15 * 60 * 1000);
}

