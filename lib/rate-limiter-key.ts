import { NextRequest } from "next/server";
import { createHash } from "crypto";

// Function to generate a composite key for rate limiting.
function generateCompositeKey(ip: string, userAgent: string | null): string {
  const identifier = `${ip}-${userAgent || ""}`;
  return createHash("sha256").update(identifier).digest("hex");
}

// Function to get a unique request identifier for rate limiting.
export function getRateLimiterKey(request: NextRequest): string {
  const ip = request.ip ?? "unknown";
  const userAgent = request.headers.get("user-agent");

  // If the IP is "unknown", generate a unique key per request to avoid collisions.
  if (ip === "unknown") {
    const random = Math.random().toString(36).substring(2, 15);
    return generateCompositeKey(random, userAgent);
  }

  return generateCompositeKey(ip, userAgent);
}
