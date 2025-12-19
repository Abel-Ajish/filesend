import { NextRequest, NextResponse } from "next/server";
import {
  InvalidFilenameError,
  generateShareCode,
  listFiles,
  uploadFile,
} from "@/lib/appwrite";
import { isRateLimited } from "@/lib/rate-limiter";
import { getRateLimiterKey } from "@/lib/rate-limiter-key";
import { validateFileType } from "@/lib/file-validator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const files = await listFiles();
    return NextResponse.json({ files });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  const key = getRateLimiterKey(request);
  if (await isRateLimited(key)) {
    return NextResponse.json(
      { error: "Too many requests." },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Missing file in request." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "Refusing to store empty file." },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File exceeds the maximum size limit." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();

    // Validate the file type against the blacklist.
    const validation = await validateFileType(buffer);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: `File type ${validation.type} is not allowed.` },
        { status: 400 }
      );
    }

    const providedCode = formData.get("code") as string | null;
    const code = providedCode || generateShareCode();

    await uploadFile({
      filename: file.name,
      arrayBuffer: buffer,
      contentType: validation.type || "application/octet-stream",
      code,
    });

    return NextResponse.json({ ok: true, code });
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

