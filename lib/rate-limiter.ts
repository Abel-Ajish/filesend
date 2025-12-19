import { redis } from "@/lib/redis";

const limit = 10; // Max requests per minute
const windowMs = 60; // 1 minute in seconds

// This Lua script performs an atomic INCR and EXPIRE operation.
const luaScript = `
  local current = redis.call("INCR", KEYS[1])
  if tonumber(current) == 1 then
    redis.call("EXPIRE", KEYS[1], ARGV[1])
  end
  return current
`;

export async function isRateLimited(key: string): Promise<boolean> {
  if (!redis) {
    // If Redis is not configured, disable rate limiting.
    return false;
  }

  try {
    // Execute the Lua script to perform an atomic INCR and EXPIRE.
    const count = await redis.eval(luaScript, [key], [windowMs]);

    // The script returns the current count.
    // If the count is greater than the limit, the request is rate-limited.
    return (count as number) > limit;
  } catch (error) {
    // If Redis is unavailable, fail open (allow the request) to avoid blocking users.
    console.error("Redis error during rate limiting:", error);
    return false;
  }
}
