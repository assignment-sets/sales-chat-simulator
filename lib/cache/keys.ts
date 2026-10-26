/**
 * Cache key builders.
 *
 * Every key must carry its tenant scope (org id, plus user id when the value
 * varies per user) so two tenants can never read each other's cached data.
 * Bump `CACHE_KEY_PREFIX` when the cached shape changes in a breaking way.
 */
export const CACHE_KEY_PREFIX = "cache:v1";

export function dashboardKey(orgId: string): string {
  return `${CACHE_KEY_PREFIX}:dashboard:org:${orgId}`;
}

export function pricingKey(orgId: string): string {
  return `${CACHE_KEY_PREFIX}:pricing:org:${orgId}`;
}

export function transcriptKey(orgId: string, chatId: string): string {
  return `${CACHE_KEY_PREFIX}:transcript:org:${orgId}:chat:${chatId}`;
}

export function memberChatsKey(orgId: string, userId: string): string {
  return `${CACHE_KEY_PREFIX}:memberchats:org:${orgId}:user:${userId}`;
}
