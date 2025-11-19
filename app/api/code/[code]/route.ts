import { NextResponse } from "next/server";
import { findFileByCode } from "@/lib/appwrite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { code: string } }
) {
  try {
    const raw = params.code?.trim();
    if (!raw) {
      return NextResponse.json(
        { error: "Missing share code." },
        { status: 400 }
      );
    }

    const file = await findFileByCode(raw);
    if (!file) {
      return NextResponse.json(
        { error: "Code not found or already expired." },
        { status: 404 }
      );
    }
    return NextResponse.json({ file });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

