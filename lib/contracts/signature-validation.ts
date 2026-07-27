export const validateSignatureData = (data: string): { ok: boolean; message?: string } => {
  if (!data.startsWith('data:image/png;base64,')) {
    return { ok: false, message: 'Signature must be a base64 PNG data URL' };
  }

  const base64 = data.slice('data:image/png;base64,'.length);
  if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
    return { ok: false, message: 'Invalid base64 characters' };
  }

  const decodedLength = Buffer.byteLength(base64, 'base64');
  if (decodedLength > 2 * 1024 * 1024) {
    return { ok: false, message: 'Signature image exceeds 2MB' };
  }
  if (decodedLength < 100) {
    return { ok: false, message: 'Signature image is too small' };
  }

  // Validate PNG magic number.
  try {
    const decoded = Buffer.from(base64, 'base64');
    if (decoded.length < 8) {
      return { ok: false, message: 'Signature image is too small' };
    }
    const pngMagic = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (!decoded.subarray(0, 8).equals(pngMagic)) {
      return { ok: false, message: 'Signature is not a valid PNG image' };
    }
  } catch {
    return { ok: false, message: 'Failed to decode signature image' };
  }

  return { ok: true };
};
