import { Queue } from 'bullmq';
import { config } from '../config.js';

const u = new URL(config.redisUrl);
const connection = {
  host: u.hostname,
  port: Number(u.port) || 6379,
  ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
};

export const pptxQueue = new Queue('pptx', { connection });
export const thumbnailQueue = new Queue('thumbnail', { connection });
