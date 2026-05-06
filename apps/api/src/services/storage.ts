import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "../config.js";

const s3 = new S3Client({
  endpoint: config.minio.endpointUrl ?? `http://${config.minio.endpoint}:${config.minio.port}`,
  region: "us-east-1",
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true,
});

export async function uploadFile(
  key: string,
  body: Buffer,
  contentType: string,
) {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.minio.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

export async function deleteFile(key: string) {
  await s3.send(
    new DeleteObjectCommand({ Bucket: config.minio.bucket, Key: key }),
  );
}

export async function getPresignedUrl(
  key: string,
  expiresIn = 3600,
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: config.minio.bucket, Key: key }),
    { expiresIn },
  );
}

export function publicUrl(key: string): string {
  // If an explicit public URL is configured (e.g. in production), use it.
  if (config.minio.publicUrl) {
    return `${config.minio.publicUrl}/${config.minio.bucket}/${key}`;
  }
  // Otherwise return a server-relative path so any device on the network
  // resolves it through the same host it's already talking to, avoiding
  // hard-coded localhost:9000 URLs that break on other machines.
  return `${config.apiPublicUrl}/api/media/proxy/${key}`;
}

export async function streamFile(key: string) {
  return s3.send(
    new GetObjectCommand({ Bucket: config.minio.bucket, Key: key }),
  );
}

export async function ensureBucket() {
  try {
    await s3.send(new HeadBucketCommand({ Bucket: config.minio.bucket }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: config.minio.bucket }));
    await s3.send(
      new PutBucketPolicyCommand({
        Bucket: config.minio.bucket,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Effect: "Allow",
              Principal: "*",
              Action: "s3:GetObject",
              Resource: `arn:aws:s3:::${config.minio.bucket}/*`,
            },
          ],
        }),
      }),
    );
  }
}
