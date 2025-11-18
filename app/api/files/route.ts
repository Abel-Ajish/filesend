import { NextResponse } from "next/server";
import { InvalidFilenameError, listFiles, uploadFile } from "@/lib/blob";

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

    const buffer = await file.arrayBuffer();
    await uploadFile({
      filename: file.name,
      arrayBuffer: buffer,
      contentType: file.type || "application/octet-stream",
    });

    return NextResponse.json({ ok: true });
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

