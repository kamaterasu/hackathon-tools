import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { config } from './config.js';
import { ensureBucket } from './services/storage.js';
import { setupSocket } from './socket/index.js';
import { startScheduler } from './services/scheduler.js';
import { mediaRoutes } from './routes/media.js';
import { playlistRoutes } from './routes/playlists.js';
import { screenRoutes } from './routes/screens.js';
import { scheduleRoutes } from './routes/schedules.js';
import { playerRoutes } from './routes/player.js';
import { pptxWorker } from './jobs/pptx.worker.js';
import { thumbnailWorker } from './jobs/thumbnail.worker.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: config.corsOrigin });
await app.register(multipart, { limits: { fileSize: 500 * 1024 * 1024 } });

await app.register(mediaRoutes);
await app.register(playlistRoutes);
await app.register(screenRoutes);
await app.register(scheduleRoutes);
await app.register(playerRoutes);

await ensureBucket();

// Start Fastify first so app.server is ready, then attach Socket.io, then start scheduler
await app.listen({ port: config.port, host: '0.0.0.0' });
setupSocket(app.server);
startScheduler();

pptxWorker.on('completed', job => app.log.info(`PPTX job ${job.id} done`));
thumbnailWorker.on('completed', job => app.log.info(`Thumbnail job ${job.id} done`));

console.log(`API running on http://localhost:${config.port}`);
