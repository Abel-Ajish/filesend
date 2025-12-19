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

  // If the IP is "unknown", generate a key based on the user agent.
  if (ip === "unknown") {
    return generateCompositeKey("unknown", userAgent);
  }

  return generateCompositeKey(ip, userAgent);
}
