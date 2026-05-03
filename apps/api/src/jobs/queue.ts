import { Queue } from 'bullmq';
import { config } from '../config.js';

const { hostname: host, port } = new URL(config.redisUrl);
const connection = { host, port: Number(port) || 6379 };

export const mediaQueue = new Queue('media', { connection });
