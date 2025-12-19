import { redis } from "@/lib/redis";

const limit = 10; // Max requests
const windowMs = 60; // 1 minute in seconds

export async function isRateLimited(key: string): Promise<boolean> {
  const keyCount = await redis.get(key);

  if (keyCount === null) {
    await redis.set(key, 1, { ex: windowMs });
    return false;
  }

  const count = Number(keyCount);
  if (count >= limit) {
    return true;
  }

  await redis.incr(key);
  return false;
}
