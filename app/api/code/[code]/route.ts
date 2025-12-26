import { NextRequest, NextResponse } from "next/server";
import { findFilesByCode } from "@/lib/appwrite";
import { isRateLimited } from "@/lib/rate-limiter";
import { getRateLimiterKey } from "@/lib/rate-limiter-key";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const key = getRateLimiterKey(request);
  if (await isRateLimited(key)) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429 }
    );
  }

  try {
    const raw = params.code?.trim();
    if (!raw) {
      return NextResponse.json(
        { error: "Missing share code." },
        { status: 400 }
      );
    }

    const files = await findFilesByCode(raw);
    if (files.length === 0) {
      return NextResponse.json(
        { error: "Code not found or already expired." },
        { status: 404 }
      );
    }
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

