import { redis } from "@/lib/redis";

const limit = 10; // Max requests per minute
const windowMs = 60; // 1 minute in seconds

export async function isRateLimited(key: string): Promise<boolean> {
  try {
    const count = await redis.incr(key);

    if (count === 1) {
      // On the first request, set the expiry for the key.
      await redis.expire(key, windowMs);
    }

    // If the count is greater than the limit, the request is rate-limited.
    return count > limit;
  } catch (error) {
    // If Redis is unavailable, fail open (allow the request) to avoid blocking users.
    console.error("Redis error during rate limiting:", error);
    return false;
  }
}
