import { list, put, del } from "@vercel/blob";

const BUCKET_PREFIX = "local-share/";
const MAX_FILENAME_LENGTH = 180;
const CONTROL_CHARS_REGEX = /[\u0000-\u001f\u007f]/g;

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
  name: string;
  size: number;
  sizeLabel: string;
  type: string;
  url: string;
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
      const name = blob.pathname.replace(BUCKET_PREFIX, "");
      return {
        id: blob.pathname,
        name,
        size: blob.size,
        sizeLabel: formatSize(blob.size),
        type:
          "contentType" in blob && typeof blob.contentType === "string"
            ? blob.contentType
            : "application/octet-stream",
        url: blob.downloadUrl,
      } satisfies SharedFile;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function uploadFile({
  filename,
  arrayBuffer,
  contentType,
}: {
  filename: string;
  arrayBuffer: ArrayBuffer;
  contentType: string;
}) {
  const token = requireToken();
  const safeName = toSafeFilename(filename);
  const pathname = `${BUCKET_PREFIX}${safeName}`;
  return await put(pathname, arrayBuffer, {
    contentType,
    access: "public",
    token,
    addRandomSuffix: false,
  });
}

export async function deleteFile(identifier: { id?: string; name?: string }) {
  const token = requireToken();
  const targetPath =
    identifier.id ??
    (identifier.name
      ? `${BUCKET_PREFIX}${toSafeFilename(identifier.name)}`
      : null);
  if (!targetPath) {
    throw new InvalidFilenameError("Missing file identifier.");
  }
  const { blobs } = await list({
    prefix: targetPath,
    token,
    limit: 1,
  });

  const target = blobs.find((blob) => blob.pathname === targetPath);
  if (!target) {
    throw new FileNotFoundError("File not found.");
  }

  await del(target.pathname, { token });
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

