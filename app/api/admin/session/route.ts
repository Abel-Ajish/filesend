import { NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const adminToken = process.env.FILES_ADMIN_TOKEN;
  if (!adminToken) {
    return NextResponse.json(
      { error: "Admin session is disabled." },
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

  const csrfToken = crypto.randomBytes(16).toString("hex");
  const response = NextResponse.json({ csrfToken });
  response.cookies.set("admin_csrf", csrfToken, {
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  return response;
}
