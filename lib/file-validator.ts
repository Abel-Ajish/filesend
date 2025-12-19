// A map of file signatures (magic bytes) for common file types.
const fileSignatures: { [key: string]: (bytes: Uint8Array) => boolean } = {
  // Images
  "image/jpeg": (bytes) => bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF,
  "image/png": (bytes) => bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47,
  "image/gif": (bytes) => bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38,
  "image/svg+xml": (bytes) => new TextDecoder().decode(bytes).trim().startsWith("<svg"),
  "image/webp": (bytes) => bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46,
  // Documents
  "application/pdf": (bytes) => bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46,
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": (bytes) => bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04,
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": (bytes) => bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04,
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": (bytes) => bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04,
  "text/plain": (bytes) => {
    // Plain text files do not have a reliable magic number.
    // We can check if the file contains valid UTF-8 characters.
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return true;
    } catch {
      return false;
    }
  },
  "text/csv": (bytes) => {
    // CSV files are plain text, so we'll use the same validation as for text/plain.
    try {
      new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      return true;
    } catch {
      return false;
    }
  },
  // Archives
  "application/zip": (bytes) => bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x03 && bytes[3] === 0x04,
  "application/vnd.rar": (bytes) => bytes[0] === 0x52 && bytes[1] === 0x61 && bytes[2] === 0x72 && bytes[3] === 0x21,
  "application/x-7z-compressed": (bytes) => bytes[0] === 0x37 && bytes[1] === 0x7A && bytes[2] === 0xBC && bytes[3] === 0xAF,
  "application/gzip": (bytes) => bytes[0] === 0x1F && bytes[1] === 0x8B,
  // Audio
  "audio/mpeg": (bytes) => bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33,
  "audio/wav": (bytes) => bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46,
  // Video
  "video/mp4": (bytes) => (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70),
  "video/quicktime": (bytes) => (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70),
  "video/x-msvideo": (bytes) => bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46,
  "video/webm": (bytes) => bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3,
  "video/x-matroska": (bytes) => bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3,
};

// Validates the file type by checking its magic bytes.
export function validateFileType(buffer: ArrayBuffer, declaredType: string): boolean {
  const validator = fileSignatures[declaredType];
  if (!validator) {
    // If the file type is not in the map, we can't validate it.
    // For security, we'll reject it.
    return false;
  }

  const bytes = new Uint8Array(buffer.slice(0, 16)); // Read a bit more for robustness
  return validator(bytes);
}
