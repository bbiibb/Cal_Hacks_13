import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// A recording that is still in storage after an hour was never transcribed: delete it (patient privacy)
crons.interval("delete stale voice recordings", { hours: 1 }, internal.speech.purgeOldRecordings, {
  olderThanMinutes: 60,
});

// A conversation nobody has used for 2 hours is deleted. The page also deletes it when the window closes.
crons.interval("delete idle conversations", { hours: 1 }, internal.chat.purgeInactiveSessions, {
  inactiveHours: 2,
});

export default crons;
