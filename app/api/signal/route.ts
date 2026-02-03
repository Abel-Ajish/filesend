import { NextResponse } from "next/server";
import { checkSignal, uploadSignal } from "@/lib/appwrite";
import { auditLog } from "@/lib/audit";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import { hasSignalSecret, registerSignalSecret, verifySignalSecret } from "@/lib/signal-secrets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_REGEX = /^[A-Z0-9]{6}$/;
const SIGNAL_TYPES = new Set(["HOST", "PEER"]);

export async function GET(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`signal-get:${ip}`, {
      limit: 120,
      windowMs: 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again soon." },
        { status: 429 }
      );
    }

    const url = new URL(request.url);
    const code = url.searchParams.get("code")?.trim().toUpperCase() ?? "";
    const type = url.searchParams.get("type")?.trim().toUpperCase() ?? "";
    const secret = url.searchParams.get("secret")?.trim() ?? "";

    if (!CODE_REGEX.test(code)) {
      return NextResponse.json(
        { error: "Share code must be exactly 6 characters." },
        { status: 400 }
      );
    }

    if (!SIGNAL_TYPES.has(type)) {
      return NextResponse.json(
        { error: "Invalid signal type." },
        { status: 400 }
      );
    }

    if (!secret) {
      auditLog({ action: "signal-get", status: "failure", ip, code, message: "missing secret" });
      return NextResponse.json(
        { error: "Missing signal secret." },
        { status: 400 }
      );
    }

    if (!verifySignalSecret(code, secret)) {
      if (!hasSignalSecret(code)) {
        registerSignalSecret(code, secret);
      } else {
        auditLog({ action: "signal-get", status: "failure", ip, code, message: "invalid secret" });
        return NextResponse.json(
          { error: "Invalid signal secret." },
          { status: 403 }
        );
      }
    }

    const payload = await checkSignal(code, type as "HOST" | "PEER");
    return NextResponse.json({ data: payload });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);
    const limit = rateLimit(`signal-post:${ip}`, {
      limit: 60,
      windowMs: 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many requests. Try again soon." },
        { status: 429 }
      );
    }

    const body = await request.json();
    const code = String(body?.code ?? "").trim().toUpperCase();
    const type = String(body?.type ?? "").trim().toUpperCase();
    const data = String(body?.data ?? "");
    const secret = String(body?.secret ?? "").trim();

    if (!CODE_REGEX.test(code)) {
      return NextResponse.json(
        { error: "Share code must be exactly 6 characters." },
        { status: 400 }
      );
    }

    if (!SIGNAL_TYPES.has(type)) {
      return NextResponse.json(
        { error: "Invalid signal type." },
        { status: 400 }
      );
    }

    if (!secret) {
      return NextResponse.json(
        { error: "Missing signal secret." },
        { status: 400 }
      );
    }

    if (!verifySignalSecret(code, secret)) {
      if (!hasSignalSecret(code)) {
        registerSignalSecret(code, secret);
      } else {
        auditLog({ action: "signal-post", status: "failure", ip, code, message: "invalid secret" });
        return NextResponse.json(
          { error: "Invalid signal secret." },
          { status: 403 }
        );
      }
    }

    if (!data) {
      return NextResponse.json(
        { error: "Missing signal payload." },
        { status: 400 }
      );
    }

    await uploadSignal(code, type as "HOST" | "PEER", data);
    auditLog({ action: "signal-post", status: "success", ip, code });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
