import { Worker } from 'bullmq';
import { config } from '../config.js';
import { db } from '../db/client.js';

const { hostname: host, port } = new URL(config.redisUrl);
const connection = { host, port: Number(port) || 6379 };

export const thumbnailWorker = new Worker('media', async (job) => {
  if (job.name !== 'thumbnail') return;
  const { mediaId, key } = job.data as { mediaId: string; key: string };
  await db.query('UPDATE media_items SET thumbnail_path=$1 WHERE id=$2', [key, mediaId]);
  return { thumbnailKey: key };
}, { connection });
