// A map of file signatures (magic bytes) for common file types.
const fileSignatures: { [key: string]: number[] } = {
  // Images
  "image/jpeg": [0xFF, 0xD8, 0xFF],
  "image/png": [0x89, 0x50, 0x4E, 0x47],
  "image/gif": [0x47, 0x49, 0x46, 0x38],
  // Documents
  "application/pdf": [0x25, 0x50, 0x44, 0x46],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [0x50, 0x4B, 0x03, 0x04],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [0x50, 0x4B, 0x03, 0x04],
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": [0x50, 0x4B, 0x03, 0x04],
  // Archives
  "application/zip": [0x50, 0x4B, 0x03, 0x04],
  "application/vnd.rar": [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07, 0x00],
  // Audio
  "audio/mpeg": [0x49, 0x44, 0x33],
  "audio/wav": [0x52, 0x49, 0x46, 0x46],
  // Video
  "video/mp4": [0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x6D, 0x70, 0x34, 0x32],
  "video/quicktime": [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74, 0x20, 0x20],
  "video/x-msvideo": [0x52, 0x49, 0x46, 0x46],
};

// Validates the file type by checking its magic bytes.
export function validateFileType(buffer: ArrayBuffer, declaredType: string): boolean {
  const signature = fileSignatures[declaredType];
  if (!signature) {
    // If the file type is not in the map, we can't validate it.
    // For security, we'll reject it.
    return false;
  }

  const bytes = new Uint8Array(buffer.slice(0, signature.length));
  return signature.every((byte, index) => byte === bytes[index]);
}
