type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  resetAt: number;
};

const store = new Map<string, RateLimitState>();
const byteStore = new Map<string, RateLimitState & { bytes: number }>();

export function rateLimit(key: string, options: RateLimitOptions) {
  const now = Date.now();
  const current = store.get(key);

  if (!current || now > current.resetAt) {
    const resetAt = now + options.windowMs;
    store.set(key, { count: 1, resetAt });
    return { allowed: true, remaining: options.limit - 1, resetAt };
  }

  if (current.count >= options.limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  store.set(key, current);
  return { allowed: true, remaining: options.limit - current.count, resetAt: current.resetAt };
}

export function consumeQuota(key: string, options: RateLimitOptions & { amount: number }) {
  const now = Date.now();
  const current = byteStore.get(key);

  if (!current || now > current.resetAt) {
    const resetAt = now + options.windowMs;
    byteStore.set(key, { count: 1, resetAt, bytes: options.amount });
    return { allowed: options.amount <= options.limit, remaining: options.limit - options.amount, resetAt };
  }

  const nextBytes = current.bytes + options.amount;
  if (nextBytes > options.limit) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.bytes = nextBytes;
  current.count += 1;
  byteStore.set(key, current);
  return { allowed: true, remaining: options.limit - current.bytes, resetAt: current.resetAt };
}

export function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}
