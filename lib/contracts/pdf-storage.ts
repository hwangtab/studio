import { put } from '@vercel/blob';

export const uploadContractPdf = async (
  contractId: string,
  pdfBuffer: Buffer,
): Promise<string> => {
  const filename = `contracts/${contractId}.pdf`;

  const blob = await put(filename, pdfBuffer, {
    access: 'private',
    contentType: 'application/pdf',
  });

  return blob.url;
};
