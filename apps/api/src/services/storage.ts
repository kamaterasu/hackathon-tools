import {
  S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand,
  CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config } from '../config.js';

const s3 = new S3Client({
  endpoint: `http://${config.minio.endpoint}:${config.minio.port}`,
  region: 'us-east-1',
  credentials: { accessKeyId: config.minio.accessKey, secretAccessKey: config.minio.secretKey },
  forcePathStyle: true,
});

export async function uploadFile(key: string, body: Buffer, contentType: string) {
  await s3.send(new PutObjectCommand({ Bucket: config.minio.bucket, Key: key, Body: body, ContentType: contentType }));
  return key;
}

export async function deleteFile(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: config.minio.bucket, Key: key }));
}

export async function getPresignedUrl(key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.minio.bucket, Key: key }), { expiresIn });
}

export function publicUrl(key: string): string {
  const base = config.minio.publicUrl ?? `http://${config.minio.endpoint}:${config.minio.port}`;
  return `${base}/${config.minio.bucket}/${key}`;
}

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.minio.bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: config.minio.bucket }));
    await s3.send(new PutBucketPolicyCommand({
      Bucket: config.minio.bucket,
      Policy: JSON.stringify({
        Version: '2012-10-17',
        Statement: [{ Effect: 'Allow', Principal: '*', Action: 's3:GetObject', Resource: `arn:aws:s3:::${config.minio.bucket}/*` }]
      })
    }));
  }
}
