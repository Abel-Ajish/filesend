import { NextResponse } from "next/server";
import {
  FileNotFoundError,
  InvalidFilenameError,
  deleteFile,
} from "@/lib/blob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: { filename: string } }
) {
  try {
    const decoded = decodeURIComponent(params.filename);
    if (!decoded) {
      return NextResponse.json(
        { error: "Missing filename parameter." },
        { status: 400 }
      );
    }
    await deleteFile(decoded);
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

