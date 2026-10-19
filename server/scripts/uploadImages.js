// Execute ONLY after checking S3 usage is free for your AWS account or approved access.
import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

if (process.env.S3_MODE !== 'aws' || !process.env.S3_BUCKET || !process.env.AWS_REGION) {
  throw new Error('Configure S3_MODE=aws, S3_BUCKET and AWS_REGION first.');
}
const s3 = new S3Client({ region: process.env.AWS_REGION });
const assetDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets');
for (let i = 1; i <= 5; i++) {
  const key = `listing-0${i}.jpg`;
  const body = await readFile(path.join(assetDir, key));
  if (body.length >= 1_000_000) throw new Error(`${key} is not under 1 MB`);
  await s3.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key, Body: body, ContentType: 'image/jpeg' }));
  console.log(`Uploaded ${key} (${body.length} bytes).`);
}
console.log('All five images are in the PRIVATE S3 bucket.');
