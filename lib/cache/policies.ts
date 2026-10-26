/**
 * Cache TTLs in seconds.
 *
 * Keep every number here — never inline a TTL in a route handler. Longer TTLs
 * are reserved for data that is expensive to compute and cheap to invalidate
 * (transcripts); short TTLs cover dashboard/pricing aggregates that change on
 * every write.
 */
export const CACHE_TTLS = {
  dashboard: 60, // seconds
  pricing: 30,
  transcript: 300,
  memberChats: 60,
} as const;
