import { NextResponse } from "next/server";
import { findFilesByCode } from "@/lib/appwrite";
import { auditLog } from "@/lib/audit";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { verifyAccessToken } from "@/lib/security";
import { hasSignalSecret, registerSignalSecret, verifySignalSecret } from "@/lib/signal-secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_REGEX = /^[A-Z0-9]{6}$/;

export async function GET(
  request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`code-get:${ip}`, {
      limit: 60,
      windowMs: 60_000,
    });
    if (!limit.allowed) {
      auditLog({ action: "code-lookup", status: "failure", ip, message: "rate limited" });
      return NextResponse.json(
        { error: "Too many requests. Try again soon." },
        { status: 429 }
      );
    }

    const raw = params.code?.trim();
    if (!raw) {
      auditLog({ action: "code-lookup", status: "failure", ip, message: "missing code" });
      const invalid = rateLimit(`code-invalid:${ip}`, {
        limit: 10,
        windowMs: 10 * 60_000,
      });
      if (!invalid.allowed) {
        return NextResponse.json(
          { error: "Too many invalid attempts. Try again later." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Missing share code." },
        { status: 400 }
      );
    }
    const normalized = raw.toUpperCase();
    if (!CODE_REGEX.test(normalized)) {
      auditLog({ action: "code-lookup", status: "failure", ip, message: "invalid code format" });
      const invalid = rateLimit(`code-invalid:${ip}`, {
        limit: 10,
        windowMs: 10 * 60_000,
      });
      if (!invalid.allowed) {
        return NextResponse.json(
          { error: "Too many invalid attempts. Try again later." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Share code must be exactly 6 characters." },
        { status: 400 }
      );
    }

    const accessToken =
      request.headers.get("x-access-token") ??
      new URL(request.url).searchParams.get("token") ??
      "";
    const signalSecret =
      request.headers.get("x-signal-secret") ??
      new URL(request.url).searchParams.get("secret") ??
      "";

    const tokenValid = accessToken ? verifyAccessToken(accessToken, normalized) : false;
    let secretValid = signalSecret ? verifySignalSecret(normalized, signalSecret) : false;
    if (!secretValid && signalSecret && !hasSignalSecret(normalized)) {
      registerSignalSecret(normalized, signalSecret);
      secretValid = true;
    }

    if (!tokenValid && !secretValid) {
      auditLog({ action: "code-lookup", status: "failure", ip, code: normalized, message: "missing token" });
      return NextResponse.json(
        { error: "Missing or invalid access token." },
        { status: 401 }
      );
    }

    const files = await findFilesByCode(normalized);
    if (files.length === 0) {
      auditLog({ action: "code-lookup", status: "failure", ip, code: normalized, message: "code not found" });
      const invalid = rateLimit(`code-invalid:${ip}`, {
        limit: 10,
        windowMs: 10 * 60_000,
      });
      if (!invalid.allowed) {
        return NextResponse.json(
          { error: "Too many invalid attempts. Try again later." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Code not found or already expired." },
        { status: 404 }
      );
    }
    auditLog({ action: "code-lookup", status: "success", ip, code: normalized });
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
