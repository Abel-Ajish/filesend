
import { Client, Storage, ID, Query, Permission, Role } from "node-appwrite";

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

function requireConfig() {
  const endpoint = process.env.APPWRITE_ENDPOINT;
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  const bucketId = process.env.APPWRITE_BUCKET_ID;

  if (!endpoint || !projectId || !apiKey || !bucketId) {
    throw new Error(
      "Missing Appwrite configuration. Ensure APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY, and APPWRITE_BUCKET_ID are set in .env.local"
    );
  }

  return { endpoint, projectId, apiKey, bucketId };
}

function getStorage() {
  const { endpoint, projectId, apiKey } = requireConfig();

  const client = new Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  return new Storage(client);
}

export async function listFiles(): Promise<SharedFile[]> {
  const storage = getStorage();
  const { bucketId } = requireConfig();

  const response = await storage.listFiles(bucketId);

  return response.files
    .map((file) => {
      const fullName = file.name;
      const codeMatch = fullName.match(/^([A-Z0-9]{4,10})-(.+)$/);
      const code = codeMatch ? codeMatch[1].toUpperCase() : null;
      const displayName = codeMatch ? codeMatch[2] : fullName;

      return {
        id: file.$id,
        code,
        name: displayName,
        size: file.sizeOriginal,
        sizeLabel: formatSize(file.sizeOriginal),
        type: file.mimeType || "application/octet-stream",
        url: getFileUrl(file.$id),
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
  const storage = getStorage();
  const { bucketId } = requireConfig();

  const safeName = toSafeFilename(filename);
  const fullName = `${code}-${safeName}`;

  // Convert ArrayBuffer to File object for Appwrite
  const blob = new Blob([arrayBuffer], { type: contentType });
  const file = new File([blob], fullName, { type: contentType });

  const uploadedFile = await storage.createFile(
    bucketId,
    ID.unique(),
    file,
    [Permission.read(Role.any())]  // Allow anyone to read/download the file
  );

  scheduleAutoDelete(uploadedFile.$id);
  return uploadedFile;
}

export async function deleteFile({
  id,
  name,
}: {
  id?: string | null;
  name?: string | null;
}) {
  const storage = getStorage();
  const { bucketId } = requireConfig();

  let fileId = id;

  // If only name is provided, find the file by name
  if (!fileId && name) {
    const files = await listFiles();
    const found = files.find((f) => f.name === name);
    if (!found) {
      throw new FileNotFoundError("File not found.");
    }
    fileId = found.id;
  }

  if (!fileId) {
    throw new InvalidFilenameError("Missing file identifier.");
  }

  try {
    await storage.deleteFile(bucketId, fileId);
  } catch (error) {
    throw new FileNotFoundError("File not found.");
  }
}

function getFileUrl(fileId: string): string {
  const { endpoint, projectId, bucketId } = requireConfig();
  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/download?project=${projectId}`;
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

function scheduleAutoDelete(fileId: string) {
  const timer = setTimeout(async () => {
    try {
      await deleteFile({ id: fileId });
    } catch (error) {
      console.warn("Failed to auto-delete file", fileId, error);
    }
  }, AUTO_DELETE_MS);
  timer.unref?.();
}

export function generateShareCode(): string {
  const chars = "ABCDEFGHIJKLMNPQRSTUVWXYZ123456789"; // Removed 0 and O for clarity
  let result = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function findFilesByCode(code: string): Promise<SharedFile[]> {
  const storage = getStorage();
  const { bucketId } = requireConfig();

  const normalized = code.trim().toUpperCase();

  // Use Query to filter files by name prefix
  const response = await storage.listFiles(bucketId, [
    Query.startsWith("name", `${normalized}-`),
  ]);

  // Filter out signal files
  const targets = response.files.filter(f => !f.name.includes("SIGNAL-"));

  return targets.map((target) => {
    const name = target.name.replace(`${normalized}-`, "");
    return {
      id: target.$id,
      code: normalized,
      name,
      size: target.sizeOriginal,
      sizeLabel: formatSize(target.sizeOriginal),
      type: target.mimeType || "application/octet-stream",
      url: getFileUrl(target.$id),
      expiresAt: null,
    };
  });
}

export async function uploadSignal(code: string, type: "HOST" | "PEER", data: string) {
  const storage = getStorage();
  const { bucketId } = requireConfig();

  const filename = `SIGNAL-${code}-${type}`;
  const file = new File([data], filename, { type: "application/json" });

  try {
    // Try to delete existing signal first
    const existing = await storage.listFiles(bucketId, [
      Query.equal("name", filename)
    ]);
    if (existing.total > 0) {
      await storage.deleteFile(bucketId, existing.files[0].$id);
    }

    const uploaded = await storage.createFile(
      bucketId,
      ID.unique(),
      file,
      [Permission.read(Role.any())]
    );

    // Auto-delete signals quickly (e.g., 2 minutes)
    setTimeout(async () => {
      try {
        await storage.deleteFile(bucketId, uploaded.$id);
      } catch { }
    }, 120 * 1000);

    return uploaded;
  } catch (error) {
    console.error("Signal upload failed", error);
    throw error;
  }
}

export async function checkSignal(code: string, type: "HOST" | "PEER"): Promise<string | null> {
  const storage = getStorage();
  const { bucketId } = requireConfig();
  const filename = `SIGNAL-${code}-${type}`;

  try {
    const response = await storage.listFiles(bucketId, [
      Query.equal("name", filename)
    ]);

    if (response.total > 0) {
      const fileId = response.files[0].$id;
      const downloadUrl = getFileUrl(fileId);
      const res = await fetch(downloadUrl);
      if (res.ok) {
        return await res.text();
      }
    }
    return null;
  } catch {
    return null;
  }
}
