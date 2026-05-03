import cron from 'node-cron';
import { db } from '../db/client.js';
import { getIo } from '../socket/index.js';
import { publicUrl } from './storage.js';

export function startScheduler() {
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const { rows: due } = await db.query(
        `SELECT s.*, p.id AS p_id, p.name AS p_name, p.loop
         FROM schedules s JOIN playlists p ON p.id = s.playlist_id
         WHERE s.start_at <= $1
           AND s.start_at >= $1 - interval '70 seconds'
           AND (s.end_at IS NULL OR s.end_at > $1)`,
        [now]
      );

      for (const schedule of due) {
        try {
          await db.query('UPDATE screens SET current_playlist_id=$1 WHERE id=$2', [schedule.playlist_id, schedule.screen_id]);
          const { rows: items } = await db.query(
            'SELECT pi.*, row_to_json(m.*) AS media FROM playlist_items pi JOIN media_items m ON m.id=pi.media_item_id WHERE pi.playlist_id=$1 ORDER BY pi.position',
            [schedule.playlist_id]
          );
          getIo().to(`screen:${schedule.screen_id}`).emit('screen:sync', {
            playlist: {
              id: schedule.p_id, name: schedule.p_name, loop: schedule.loop,
              items: items.map(i => ({
                ...i,
                media: {
                  ...i.media,
                  file_url: i.media.file_path ? publicUrl(i.media.file_path) : null,
                  slides: i.media.type === 'pptx' && i.media.slide_count
                    ? Array.from({ length: i.media.slide_count }, (_: unknown, idx: number) => publicUrl(`${i.media.file_path}-slide-${idx + 1}.png`))
                    : undefined,
                }
              }))
            },
            current_index: 0,
          });
          await db.query("INSERT INTO screen_events(screen_id,event_type,triggered_by) VALUES($1,'schedule_start','scheduler')", [schedule.screen_id]);
        } catch (err) {
          console.error(`Scheduler: failed for screen ${schedule.screen_id}`, err);
        }
      }
    } catch (err) {
      console.error('Scheduler: DB query failed', err);
    }
  });
}
