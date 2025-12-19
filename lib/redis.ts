import { Redis } from "@upstash/redis";

const upstashRedisRestUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashRedisRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!upstashRedisRestUrl || !upstashRedisRestToken) {
  throw new Error("Missing Upstash Redis environment variables.");
}

export const redis = new Redis({
  url: upstashRedisRestUrl,
  token: upstashRedisRestToken,
});
