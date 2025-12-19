import { fileTypeFromBuffer } from "file-type";
import JSZip from "jszip";

// A blacklist of high-risk MIME types that should not be allowed.
const blacklistedTypes = new Set([
  "application/x-dosexec",
  "application/x-msdownload",
  "application/x-msi",
  "application/java-archive",
  "application/x-sh",
  "application/x-csh",
  "application/javascript",
  "text/html",
]);

// Helper function to validate Office Open XML documents.
async function validateOfficeDocument(buffer: ArrayBuffer): Promise<boolean> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    // Check for the presence of a file that is required for all Office Open XML documents.
    return zip.file("[Content_Types].xml") !== null;
  } catch {
    return false;
  }
}

// Special handling for text-based formats that need more than magic bytes.
const specialValidators: { [key: string]: (buffer: ArrayBuffer) => Promise<boolean> | boolean } = {
  "image/svg+xml": (buffer) => {
    try {
      // Decode the buffer and check for SVG tags.
      const text = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      const trimmed = text.trim();
      return trimmed.startsWith("<svg") || trimmed.startsWith("<?xml");
    } catch {
      return false;
    }
  },
  "audio/mpeg": (buffer) => {
    const bytes = new Uint8Array(buffer.slice(0, 3));
    // Check for ID3 tag or MPEG audio stream sync word.
    return (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) || (bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0);
  },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": validateOfficeDocument,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": validateOfficeDocument,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": validateOfficeDocument,
};

// Validates the file type by detecting its MIME type from the buffer
// and checking it against a blacklist of high-risk file types.
export async function validateFileType(buffer: ArrayBuffer): Promise<{ isValid: boolean; type?: string }> {
  const detectedType = await fileTypeFromBuffer(buffer);

  if (detectedType && specialValidators[detectedType.mime]) {
    const isValid = await specialValidators[detectedType.mime](buffer);
    return { isValid, type: detectedType.mime };
  }

  if (detectedType && blacklistedTypes.has(detectedType.mime)) {
    return { isValid: false, type: detectedType.mime };
  }

  return { isValid: true, type: detectedType?.mime || "application/octet-stream" };
}
