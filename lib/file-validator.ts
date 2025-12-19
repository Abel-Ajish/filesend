import { fileTypeFromBuffer } from "file-type";

// A blacklist of high-risk MIME types that should not be allowed.
const blacklistedTypes = new Set([
  "application/x-dosexec", // .exe
  "application/x-msdownload", // .exe
  "application/x-msi", // .msi
  "application/java-archive", // .jar
  "application/x-sh", // .sh
  "application/x-csh", // .csh
  "application/javascript", // .js
  "text/html", // .html
]);

// Validates the file type by detecting its MIME type from the buffer
// and checking it against a blacklist of high-risk file types.
export async function validateFileType(buffer: ArrayBuffer): Promise<{ isValid: boolean; type?: string }> {
  const detectedType = await fileTypeFromBuffer(buffer);

  if (!detectedType) {
    // If the file type cannot be determined, it might be a text file or an unknown format.
    // For now, we will allow it, but this could be made stricter if needed.
    return { isValid: true, type: "application/octet-stream" };
  }

  if (blacklistedTypes.has(detectedType.mime)) {
    return { isValid: false, type: detectedType.mime };
  }

  return { isValid: true, type: detectedType.mime };
}
