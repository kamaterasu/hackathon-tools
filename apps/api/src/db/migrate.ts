import { readdir, readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './client.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, 'migrations');

async function migrate() {
  await db.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ DEFAULT now()
  )`);

  const files = (await readdir(migrationsDir))
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const { rows } = await db.query(
      'SELECT 1 FROM schema_migrations WHERE version = $1',
      [file]
    );
    if (rows.length > 0) continue;

    const sql = await readFile(path.join(migrationsDir, file), 'utf-8');
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations(version) VALUES($1)', [file]);
    console.log(`Applied: ${file}`);
  }

  console.log('Migrations complete');
  process.exit(0);
}

migrate().catch(err => { console.error(err); process.exit(1); });
