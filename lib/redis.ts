import { Redis } from "@upstash/redis";

let redis: Redis | null = null;

const upstashRedisRestUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashRedisRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (upstashRedisRestUrl && upstashRedisRestToken) {
  redis = new Redis({
    url: upstashRedisRestUrl,
    token: upstashRedisRestToken,
  });
} else {
  console.warn("Missing Upstash Redis environment variables. Rate limiting will be disabled.");
}

export { redis };
