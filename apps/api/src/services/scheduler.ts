import cron from 'node-cron';
import { db } from '../db/client.js';
import { getIo, startPlaylistClock, stopPlaylistClock, getPlaylistClockState } from '../socket/index.js';
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
          const resolvedPlaylist = {
            id: schedule.p_id,
            name: schedule.p_name,
            loop: schedule.loop,
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
          };

          // Join this screen's socket to the playlist room
          getIo().in(`screen:${schedule.screen_id}`).socketsJoin(`playlist:${schedule.playlist_id}`);

          // Start/restart the shared playlist clock (all screens on this playlist sync together)
          const existing = getPlaylistClockState(schedule.playlist_id);
          if (!existing) {
            startPlaylistClock(schedule.playlist_id, resolvedPlaylist, 0);
          }

          // Catch this screen up to the current clock state
          const state = getPlaylistClockState(schedule.playlist_id)!;
          getIo().to(`screen:${schedule.screen_id}`).emit('screen:sync', {
            playlist: state.resolvedPlaylist,
            current_index: state.currentIndex,
            started_at: state.startedAt,
          });

          await db.query("INSERT INTO screen_events(screen_id,event_type,triggered_by) VALUES($1,'schedule_start','scheduler')", [schedule.screen_id]);
        } catch (err) {
          console.error(`Scheduler: failed for screen ${schedule.screen_id}`, err);
        }
      }

      // Revert screens whose active schedule just expired
      const { rows: expired } = await db.query(
        `SELECT DISTINCT s.screen_id, s.playlist_id
         FROM schedules s
         WHERE s.end_at <= $1
           AND s.end_at >= $1 - interval '70 seconds'
           AND NOT EXISTS (
             SELECT 1 FROM schedules s2
             WHERE s2.screen_id = s.screen_id
               AND s2.start_at <= $1
               AND (s2.end_at IS NULL OR s2.end_at > $1)
           )`,
        [now]
      );

      for (const { screen_id, playlist_id } of expired) {
        try {
          await db.query('UPDATE screens SET current_playlist_id=NULL WHERE id=$1', [screen_id]);
          getIo().in(`screen:${screen_id}`).socketsLeave(`playlist:${playlist_id}`);
          getIo().to(`screen:${screen_id}`).emit('screen:sync', { playlist: null, current_index: 0, started_at: Date.now() });
          await db.query("INSERT INTO screen_events(screen_id,event_type,triggered_by) VALUES($1,'schedule_end','scheduler')", [screen_id]);

          // Stop clock if no screens remain on this playlist
          const { rows: remaining } = await db.query(
            'SELECT id FROM screens WHERE current_playlist_id=$1 AND status=$2',
            [playlist_id, 'online']
          );
          if (!remaining.length) stopPlaylistClock(playlist_id);
        } catch (err) {
          console.error(`Scheduler: failed expiry for screen ${screen_id}`, err);
        }
      }
    } catch (err) {
      console.error('Scheduler: DB query failed', err);
    }
  });
}
