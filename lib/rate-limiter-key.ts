import { NextRequest } from "next/server";
import { createHash } from "crypto";

// Function to get a unique request identifier for rate limiting.
export function getRateLimiterKey(request: NextRequest): string {
  const ip = request.ip;
  const userAgent = request.headers.get("user-agent");
  const acceptLanguage = request.headers.get("accept-language");
  const acceptEncoding = request.headers.get("accept-encoding");
  const xForwardedFor = request.headers.get("x-forwarded-for");

  if (ip) {
    // If the IP is available, create a key from the IP and user agent.
    const identifier = `${ip}-${userAgent || ""}`;
    return createHash("sha256").update(identifier).digest("hex");
  }

  // If the IP is not available, create a more robust fingerprint from other headers.
  // This is not as reliable as an IP, but it's a reasonable fallback.
  console.warn("IP address not available for rate limiting. Using a fallback key.");
  const identifier = `${userAgent || ""}-${acceptLanguage || ""}-${acceptEncoding || ""}-${xForwardedFor || ""}`;
  return createHash("sha256").update(identifier).digest("hex");
}
