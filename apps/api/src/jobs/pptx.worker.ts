import { Worker } from 'bullmq';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'fs/promises';
import path from 'path';
import os from 'os';
import { config } from '../config.js';
import { uploadFile } from '../services/storage.js';
import { db } from '../db/client.js';

const execFileAsync = promisify(execFile);
const u = new URL(config.redisUrl);
const connection = {
  host: u.hostname,
  port: Number(u.port) || 6379,
  ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
};

export const pptxWorker = new Worker('pptx', async (job) => {
  if (job.name !== 'convert-pptx') return;
  const { mediaId, key } = job.data as { mediaId: string; key: string };

  const fileUrl = `http://${config.minio.endpoint}:${config.minio.port}/${config.minio.bucket}/${key}`;
  const res = await fetch(fileUrl);
  if (!res.ok) throw new Error(`Failed to fetch file: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'pptx-'));
  try {
    const inFile = path.join(tmpDir, 'input.pptx');
    await writeFile(inFile, buf);

    await execFileAsync('libreoffice', ['--headless', '--convert-to', 'png', '--outdir', tmpDir, inFile]);

    const pngFiles = (await readdir(tmpDir)).filter(f => f.endsWith('.png')).sort();
    for (let i = 0; i < pngFiles.length; i++) {
      const pngBuf = await readFile(path.join(tmpDir, pngFiles[i]));
      await uploadFile(`${key}-slide-${i + 1}.png`, pngBuf, 'image/png');
    }

    const thumbnailKey = pngFiles.length > 0 ? `${key}-slide-1.png` : null;
    await db.query('UPDATE media_items SET slide_count=$1, thumbnail_path=$2 WHERE id=$3', [pngFiles.length, thumbnailKey, mediaId]);
    await rm(tmpDir, { recursive: true, force: true });
    return { slideCount: pngFiles.length };
  } catch (err) {
    await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
    throw err;
  }
}, { connection });
