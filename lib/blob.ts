import { randomBytes } from "node:crypto";
import { del, list, put } from "@vercel/blob";

const BUCKET_PREFIX = "local-share/";
const MAX_FILENAME_LENGTH = 180;
const CONTROL_CHARS_REGEX = /[\u0000-\u001f\u007f]/g;
const AUTO_DELETE_MS = 60 * 1000;
const CODE_LENGTH = 6;

export class InvalidFilenameError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFilenameError";
  }
}

export class FileNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FileNotFoundError";
  }
}

export type SharedFile = {
  id: string;
  code: string | null;
  name: string;
  size: number;
  sizeLabel: string;
  type: string;
  url: string;
  expiresAt: string | null;
};

function requireToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "Missing BLOB_READ_WRITE_TOKEN environment variable. Generate one in the Vercel dashboard."
    );
  }
  return token;
}

export async function listFiles(): Promise<SharedFile[]> {
  const token = requireToken();
  const { blobs } = await list({
    prefix: BUCKET_PREFIX,
    token,
  });

  return blobs
    .map((blob) => {
      const fullName = blob.pathname.replace(BUCKET_PREFIX, "");
      const codeMatch = fullName.match(/^([A-Z0-9]{4,10})-(.+)$/);
      const code = codeMatch ? codeMatch[1].toUpperCase() : null;
      const displayName = codeMatch ? codeMatch[2] : fullName;
      return {
        id: blob.pathname,
        code,
        name: displayName,
        size: blob.size,
        sizeLabel: formatSize(blob.size),
        type:
          "contentType" in blob && typeof blob.contentType === "string"
            ? blob.contentType
            : "application/octet-stream",
        url: blob.downloadUrl,
        expiresAt: null,
      } satisfies SharedFile;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function uploadFile({
  filename,
  arrayBuffer,
  contentType,
  code,
}: {
  filename: string;
  arrayBuffer: ArrayBuffer;
  contentType: string;
  code: string;
}) {
  const token = requireToken();
  const safeName = toSafeFilename(filename);
  const pathname = `${BUCKET_PREFIX}${code}-${safeName}`;
  const blob = await put(pathname, arrayBuffer, {
    contentType,
    access: "public",
    token,
    addRandomSuffix: false,
  });
  scheduleAutoDelete(pathname, token);
  return blob;
}

export async function deleteFile({
  id,
  name,
}: {
  id?: string | null;
  name?: string | null;
}) {
  const token = requireToken();
  const targetPath = id
    ? decodeURIComponent(id)
    : name
      ? `${BUCKET_PREFIX}${toSafeFilename(name)}`
      : null;
  if (!targetPath) {
    throw new InvalidFilenameError("Missing file identifier.");
  }
  try {
    await del(targetPath, { token });
  } catch (error) {
    throw new FileNotFoundError("File not found.");
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;
  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function toSafeFilename(raw: string) {
  const base = raw.split(/[/\\]/).pop() ?? "";
  const trimmed = base.trim().replace(CONTROL_CHARS_REGEX, "");
  if (!trimmed) {
    throw new InvalidFilenameError("Filename cannot be empty.");
  }
  if (trimmed.length > MAX_FILENAME_LENGTH) {
    return trimmed.slice(0, MAX_FILENAME_LENGTH);
  }
  return trimmed;
}

function scheduleAutoDelete(pathname: string, token: string) {
  const timer = setTimeout(async () => {
    try {
      await del(pathname, { token });
    } catch (error) {
      console.warn("Failed to auto-delete blob", pathname, error);
    }
  }, AUTO_DELETE_MS);
  timer.unref?.();
}

export function generateShareCode(): string {
  // base64 can include + and /, remove non-alphanumeric
  const raw = randomBytes(6).toString("base64");
  const cleaned = raw.replace(/[^A-Z0-9]/gi, "").toUpperCase();
  if (cleaned.length >= CODE_LENGTH) {
    return cleaned.slice(0, CODE_LENGTH);
  }
  return (cleaned + "ABCDEFGH").slice(0, CODE_LENGTH);
}

export async function findFileByCode(code: string): Promise<SharedFile | null> {
  const token = requireToken();
  const normalized = code.trim().toUpperCase();
  const prefix = `${BUCKET_PREFIX}${normalized}-`;
  const { blobs } = await list({
    prefix,
    token,
    limit: 1,
  });
  const target = blobs.find((blob) => blob.pathname.startsWith(prefix));
  if (!target) {
    return null;
  }
  const name = target.pathname.replace(prefix, "");
  return {
    id: target.pathname,
    code: normalized,
    name,
    size: target.size,
    sizeLabel: formatSize(target.size),
    type:
      "contentType" in target && typeof target.contentType === "string"
        ? target.contentType
        : "application/octet-stream",
    url: target.downloadUrl,
    expiresAt: null,
  };
}

