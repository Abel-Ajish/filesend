import { NextResponse } from "next/server";
import {
  FileNotFoundError,
  InvalidFilenameError,
  deleteFile,
} from "@/lib/appwrite";
import { auditLog } from "@/lib/audit";
import { getClientIp, rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  { params }: { params: { filename: string } }
) {
  try {
    const adminToken = process.env.FILES_ADMIN_TOKEN;
    if (!adminToken) {
      return NextResponse.json(
        { error: "Deleting files is disabled." },
        { status: 403 }
      );
    }
    const providedToken = request.headers.get("x-admin-token") ?? undefined;
    if (providedToken !== adminToken) {
      auditLog({ action: "delete", status: "failure", message: "unauthorized" });
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
    const ip = getClientIp(request);
    const limit = rateLimit(`files-delete:${ip}`, {
      limit: 20,
      windowMs: 60_000,
    });
    if (!limit.allowed) {
      auditLog({ action: "delete", status: "failure", ip, message: "rate limited" });
      return NextResponse.json(
        { error: "Too many delete attempts. Try again soon." },
        { status: 429 }
      );
    }
    const url = new URL(request.url);
    const idParam = url.searchParams.get("id");
    const decoded = decodeURIComponent(params.filename);
    if (!decoded) {
      return NextResponse.json(
        { error: "Missing filename parameter." },
        { status: 400 }
      );
    }
    await deleteFile({ id: idParam ?? undefined, name: decoded });
    auditLog({ action: "delete", status: "success", ip, filename: decoded, fileId: idParam });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof InvalidFilenameError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof FileNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
