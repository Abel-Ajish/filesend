import { NextResponse } from "next/server";
import {
  InvalidFilenameError,
  generateShareCode,
  listFiles,
  uploadFile,
} from "@/lib/appwrite";
import { auditLog } from "@/lib/audit";
import { getClientIp, rateLimit, consumeQuota } from "@/lib/rate-limit";
import { generateAccessToken, generateSignalSecret } from "@/lib/security";
import { registerSignalSecret } from "@/lib/signal-secrets";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_BYTES_PER_MINUTE = 200 * 1024 * 1024; // 200MB
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/zip",
  "application/json",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/gif",
  "audio/mpeg",
  "video/mp4",
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CODE_REGEX = /^[A-Z0-9]{6}$/;

export async function GET(request: Request) {
  try {
    const adminToken = process.env.FILES_ADMIN_TOKEN;
    if (!adminToken) {
      return NextResponse.json(
        { error: "Listing files is disabled." },
        { status: 403 }
      );
    }
    const providedToken = request.headers.get("x-admin-token") ?? undefined;
    if (providedToken !== adminToken) {
      return NextResponse.json(
        { error: "Unauthorized." },
        { status: 401 }
      );
    }
    const csrfToken = request.headers.get("x-csrf-token");
    const csrfCookie = request.headers
      .get("cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith("admin_csrf="))
      ?.split("=")[1];
    if (!csrfToken || !csrfCookie || csrfToken !== csrfCookie) {
      return NextResponse.json(
        { error: "Invalid CSRF token." },
        { status: 403 }
      );
    }
    const files = await listFiles();
    const redacted = files.map((file) => ({
      id: file.id,
      name: file.name,
      type: file.type,
      sizeLabel: file.sizeLabel,
      code: file.code,
      expiresAt: file.expiresAt,
    }));
    return NextResponse.json({ files: redacted });
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
    const limit = rateLimit(`files-post:${ip}`, {
      limit: 30,
      windowMs: 60_000,
    });
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Too many upload attempts. Try again soon." },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      auditLog({ action: "upload", status: "failure", ip, message: "missing file" });
      return NextResponse.json(
        { error: "Missing file in request." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      auditLog({ action: "upload", status: "failure", ip, message: "empty file" });
      return NextResponse.json(
        { error: "Refusing to store empty file." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      auditLog({ action: "upload", status: "failure", ip, message: "file too large" });
      return NextResponse.json(
        { error: "File exceeds the 50MB limit." },
        { status: 413 }
      );
    }

    if (file.type && !ALLOWED_TYPES.has(file.type)) {
      auditLog({ action: "upload", status: "failure", ip, message: "invalid mime type" });
      return NextResponse.json(
        { error: "File type is not allowed." },
        { status: 415 }
      );
    }

    const quota = consumeQuota(`files-bytes:${ip}`, {
      limit: MAX_BYTES_PER_MINUTE,
      windowMs: 60_000,
      amount: file.size,
    });
    if (!quota.allowed) {
      auditLog({ action: "upload", status: "failure", ip, message: "quota exceeded" });
      return NextResponse.json(
        { error: "Upload quota exceeded. Try again later." },
        { status: 429 }
      );
    }

    const buffer = await file.arrayBuffer();
    const providedCode = formData.get("code") as string | null;
    if (providedCode && !CODE_REGEX.test(providedCode.toUpperCase())) {
      auditLog({ action: "upload", status: "failure", ip, message: "invalid share code" });
      return NextResponse.json(
        { error: "Share code must be exactly 6 characters." },
        { status: 400 }
      );
    }
    const code = (providedCode || generateShareCode()).toUpperCase();
    const accessToken = generateAccessToken(code);
    const signalSecret = generateSignalSecret();
    registerSignalSecret(code, signalSecret);

    await uploadFile({
      filename: file.name,
      arrayBuffer: buffer,
      contentType: file.type || "application/octet-stream",
      code,
    });

    auditLog({ action: "upload", status: "success", ip, code, filename: file.name });
    return NextResponse.json({ ok: true, code, accessToken, signalSecret });
  } catch (error) {
    if (error instanceof InvalidFilenameError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
