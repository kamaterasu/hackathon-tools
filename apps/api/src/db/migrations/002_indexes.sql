-- FK indexes for query performance
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist_id ON playlist_items(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_items_media_item_id ON playlist_items(media_item_id);
CREATE INDEX IF NOT EXISTS idx_schedules_screen_id ON schedules(screen_id);
CREATE INDEX IF NOT EXISTS idx_schedules_playlist_id ON schedules(playlist_id);
CREATE INDEX IF NOT EXISTS idx_screen_events_screen_id ON screen_events(screen_id);
CREATE INDEX IF NOT EXISTS idx_screens_current_playlist_id ON screens(current_playlist_id);
