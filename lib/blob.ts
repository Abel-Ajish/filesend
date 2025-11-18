"use server";

import { list, put, del } from "@vercel/blob";

const BUCKET_PREFIX = "local-share/";

function requireToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error(
      "Missing BLOB_READ_WRITE_TOKEN environment variable. Generate one in the Vercel dashboard."
    );
  }
  return token;
}

export async function listFiles() {
  const token = requireToken();
  const { blobs } = await list({
    prefix: BUCKET_PREFIX,
    token,
  });

  return blobs
    .map((blob) => ({
      name: blob.pathname.replace(BUCKET_PREFIX, ""),
      size: blob.size,
      sizeLabel: formatSize(blob.size),
      type: blob.contentType ?? "application/octet-stream",
      url: blob.downloadUrl,
    }))
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
  const pathname = `${BUCKET_PREFIX}${filename}`;
  return await put(pathname, arrayBuffer, {
    contentType,
    access: "public",
    token,
  });
}

export async function deleteFile(filename: string) {
  const token = requireToken();
  const pathname = `${BUCKET_PREFIX}${filename}`;
  await del(pathname, { token });
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

