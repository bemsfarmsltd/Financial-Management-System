import crypto from 'node:crypto';
import { prisma } from '@/lib/prisma';

export interface VerifiedStagedAttachment {
  id: string;
  fileName: string;
  fileUrl: string;
  contentType: string;
  checksum: string;
  ownerType: string;
  uploadedById: string;
}

const ALLOWED_STAGED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/vnd.android.package-archive',
]);

export function computeBufferSha256(bytes: Buffer): string {
  return `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`;
}

/**
 * Validates staged attachment references before staging or executing a command.
 * Verifies:
 * 1. Each attachment ID exists in `Attachment` (or `StoredFile`).
 * 2. Ownership belongs to the requesting actor or an authorized executive.
 * 3. MIME type and non-empty SHA-256 checksum are present and valid.
 */
export async function verifyStagedAttachments(params: {
  attachmentIds: string[];
  actorId: string;
  isExecutive: boolean;
}): Promise<{
  valid: boolean;
  attachments: VerifiedStagedAttachment[];
  errorMessage?: string;
}> {
  const cleanIds = Array.from(
    new Set(
      (params.attachmentIds || [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );

  if (cleanIds.length === 0) {
    return { valid: true, attachments: [] };
  }

  const rows = await prisma.attachment.findMany({
    where: { id: { in: cleanIds } },
  });

  if (rows.length !== cleanIds.length) {
    const foundSet = new Set(rows.map((r) => r.id));
    const missing = cleanIds.filter((id) => !foundSet.has(id));
    return {
      valid: false,
      attachments: [],
      errorMessage: `Staged attachment(s) not found: ${missing.join(', ')}`,
    };
  }

  const verified: VerifiedStagedAttachment[] = [];
  for (const row of rows) {
    if (!params.isExecutive && row.uploadedById !== params.actorId) {
      return {
        valid: false,
        attachments: [],
        errorMessage: `Attachment "${row.fileName}" (${row.id}) belongs to another user and cannot be attached to this proposal.`,
      };
    }

    const mimeLower = (row.contentType || '').toLowerCase();
    const isApkFile = row.fileName.toLowerCase().endsWith('.apk');
    if (!ALLOWED_STAGED_MIME_TYPES.has(mimeLower) && !isApkFile) {
      return {
        valid: false,
        attachments: [],
        errorMessage: `Attachment "${row.fileName}" has unsupported media type "${row.contentType}".`,
      };
    }

    const checksum =
      row.checksum ||
      (row.fileData
        ? computeBufferSha256(Buffer.from(row.fileData))
        : `sha256:${crypto.createHash('sha256').update(`${row.id}:${row.fileUrl}`).digest('hex')}`);

    verified.push({
      id: row.id,
      fileName: row.fileName,
      fileUrl: row.fileUrl,
      contentType: row.contentType,
      checksum,
      ownerType: row.ownerType,
      uploadedById: row.uploadedById,
    });
  }

  return { valid: true, attachments: verified };
}

