import { NextRequest } from "next/server";
import { createHash } from "crypto";

// Function to generate a composite key for rate limiting.
function generateCompositeKey(ip: string, headers: { [key: string]: string | null }): string {
  const identifier = `${ip}-${headers["user-agent"] || ""}-${headers["accept-language"] || ""}-${headers["accept-encoding"] || ""}`;
  return createHash("sha256").update(identifier).digest("hex");
}

// Function to get a unique request identifier for rate limiting.
export function getRateLimiterKey(request: NextRequest): string {
  const ip = request.ip ?? "unknown";
  const headers = {
    "user-agent": request.headers.get("user-agent"),
    "accept-language": request.headers.get("accept-language"),
    "accept-encoding": request.headers.get("accept-encoding"),
  };

  return generateCompositeKey(ip, headers);
}
