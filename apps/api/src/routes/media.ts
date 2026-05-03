import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'crypto';
import path from 'path';
import { db } from '../db/client.js';
import { uploadFile, deleteFile, publicUrl } from '../services/storage.js';
import { pptxQueue, thumbnailQueue } from '../jobs/queue.js';

export async function mediaRoutes(app: FastifyInstance) {
  app.get('/api/media', async (_req, reply) => {
    const { rows } = await db.query('SELECT * FROM media_items ORDER BY created_at DESC');
    return reply.send(rows.map(r => ({
      ...r,
      thumbnail_url: r.thumbnail_path ? publicUrl(r.thumbnail_path) : null,
      file_url: r.file_path ? publicUrl(r.file_path) : null,
    })));
  });

  app.get('/api/media/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows } = await db.query('SELECT * FROM media_items WHERE id = $1', [id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    const item = rows[0];
    const slides = item.type === 'pptx' && item.slide_count
      ? Array.from({ length: item.slide_count }, (_, i) => publicUrl(`${item.file_path}-slide-${i + 1}.png`))
      : undefined;
    return reply.send({ ...item, file_url: item.file_path ? publicUrl(item.file_path) : null, slides });
  });

  app.post('/api/media/upload', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'No file' });
    const buf = await data.toBuffer();
    const ext = path.extname(data.filename).toLowerCase();
    const key = `uploads/${randomUUID()}${ext}`;
    await uploadFile(key, buf, data.mimetype);
    const type = ext === '.pptx' ? 'pptx'
      : ['.jpg','.jpeg','.png','.gif','.webp'].includes(ext) ? 'image'
      : ['.mp4','.webm','.mov'].includes(ext) ? 'video' : 'image';
    const { rows } = await db.query<{ id: string }>(
      "INSERT INTO media_items(name, type, file_path) VALUES($1,$2,$3) RETURNING id",
      [data.filename, type, key]
    );
    const mediaId = rows[0].id;
    if (type === 'pptx') {
      const job = await pptxQueue.add('convert-pptx', { mediaId, key });
      return reply.code(202).send({ mediaId, jobId: job.id });
    }
    await thumbnailQueue.add('thumbnail', { mediaId, key, type });
    return reply.code(201).send({ mediaId });
  });

  app.post('/api/media/url', async (req, reply) => {
    const { name, url, duration_seconds = 30 } = req.body as { name: string; url: string; duration_seconds?: number };
    const { rows } = await db.query(
      "INSERT INTO media_items(name, type, url, duration_seconds) VALUES($1,'url',$2,$3) RETURNING *",
      [name, url, duration_seconds]
    );
    return reply.code(201).send(rows[0]);
  });

  app.delete('/api/media/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const { rows } = await db.query('SELECT * FROM media_items WHERE id = $1', [id]);
    if (!rows.length) return reply.code(404).send({ error: 'Not found' });
    const item = rows[0];
    if (item.file_path) await deleteFile(item.file_path).catch(() => {});
    if (item.thumbnail_path && item.thumbnail_path !== item.file_path) await deleteFile(item.thumbnail_path).catch(() => {});
    await db.query('DELETE FROM media_items WHERE id = $1', [id]);
    return reply.code(204).send();
  });
}
