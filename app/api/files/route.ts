import { NextResponse } from "next/server";
import {
  InvalidFilenameError,
  generateShareCode,
  listFiles,
  uploadFile,
} from "@/lib/appwrite";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { unlink } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { Readable } from "stream";
import { randomUUID } from "crypto";

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

export async function POST(request: Request) {
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

  // Use a UUID for the temporary file to avoid potential collisions.
  const tempFilePath = join(tmpdir(), `upload_${randomUUID()}`);

  try {
    // Stream the file from the FormData object to a temporary file.
    // This avoids buffering the entire file in memory.
    await pipeline(
      Readable.fromWeb(file.stream() as any),
      createWriteStream(tempFilePath)
    );

    const providedCode = formData.get("code") as string | null;
    const code = providedCode || generateShareCode();

    // The modified uploadFile function now takes a file path.
    await uploadFile({
      filename: file.name,
      filePath: tempFilePath,
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
  } finally {
    // Ensure the temporary file is deleted after the upload.
    await unlink(tempFilePath).catch((err) =>
      console.error(`Failed to delete temp file: ${tempFilePath}`, err)
    );
  }
}

