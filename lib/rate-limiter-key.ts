import { NextRequest } from "next/server";
import { createHash } from "crypto";

// Function to get a unique request identifier for rate limiting.
export function getRateLimiterKey(request: NextRequest): string {
  const ip = request.ip;
  const userAgent = request.headers.get("user-agent");

  if (ip) {
    // If the IP is available, create a key from the IP and user agent.
    const identifier = `${ip}-${userAgent || ""}`;
    return createHash("sha256").update(identifier).digest("hex");
  }

  // If the IP is not available, create a key from the user agent.
  // This is not as reliable as an IP, but it's a reasonable fallback.
  const identifier = `${userAgent || ""}`;
  return createHash("sha256").update(identifier).digest("hex");
}
