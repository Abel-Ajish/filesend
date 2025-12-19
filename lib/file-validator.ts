// lib/file-validator.ts
export function validateFileType(buffer: ArrayBuffer, declaredType: string): boolean {
  const bytes = new Uint8Array(buffer.slice(0, 12));

  // Check magic bytes for common file types
  if (declaredType === "image/jpeg") {
    return bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF;
  } else if (declaredType === "image/png") {
    return bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47;
  } else if (declaredType === "image/gif") {
    return bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
  } else if (declaredType === "application/pdf") {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }

  return false;
}
