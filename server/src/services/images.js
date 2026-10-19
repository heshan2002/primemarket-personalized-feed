import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const assetsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../assets');
const maxBytes = 1_000_000; // strictly under 1 MB per assessment

export async function getListingImage(imageKey) {
  if (!/^listing-0[1-5]\.jpg$/.test(imageKey)) throw new Error('Unexpected image key');
  const mode = process.env.S3_MODE || 'mock';
  if (mode === 'mock') {
    const bytes = await readFile(path.join(assetsDir, imageKey));
    if (bytes.length >= maxBytes) throw new Error('Image exceeds size limit');
    return { bytes, contentType: 'image/jpeg' };
  }
  if (mode !== 'aws') throw new Error('S3_MODE must be aws or mock');
  if (!process.env.S3_BUCKET || !process.env.AWS_REGION) throw new Error('S3 configuration missing');
  // AWS SDK resolves credentials server-side from the environment / standard provider chain.
  const s3 = new S3Client({ region: process.env.AWS_REGION });
  const response = await s3.send(new GetObjectCommand({ Bucket: process.env.S3_BUCKET, Key: imageKey }));
  if (response.ContentLength != null && response.ContentLength >= maxBytes) {
    response.Body?.destroy?.();
    throw new Error('S3 object exceeds size limit');
  }
  const bytes = Buffer.from(await response.Body.transformToByteArray());
  if (bytes.length >= maxBytes) throw new Error('S3 object exceeds size limit');
  return { bytes, contentType: response.ContentType === 'image/jpeg' ? 'image/jpeg' : 'application/octet-stream' };
}
