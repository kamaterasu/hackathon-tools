export type MediaType = 'image' | 'video' | 'pptx' | 'url';
export type ScreenStatus = 'online' | 'offline';
export type TransitionType = 'fade' | 'cut' | 'slide';
export type EventType = 'play' | 'pause' | 'next' | 'prev' | 'schedule_start' | 'manual';

export interface Screen {
  id: string;
  name: string;
  location: string | null;
  api_key: string;
  status: ScreenStatus;
  last_seen_at: string | null;
  current_playlist_id: string | null;
  created_at: string;
}

export interface MediaItem {
  id: string;
  name: string;
  type: MediaType;
  file_path: string | null;
  url: string | null;
  duration_seconds: number;
  slide_count: number | null;
  thumbnail_path: string | null;
  created_at: string;
}

export interface Playlist {
  id: string;
  name: string;
  loop: boolean;
  created_at: string;
}

export interface PlaylistItem {
  id: string;
  playlist_id: string;
  media_item_id: string;
  position: number;
  duration_seconds: number | null;
  transition: TransitionType;
}

export interface Schedule {
  id: string;
  screen_id: string;
  playlist_id: string;
  start_at: string;
  end_at: string | null;
  recurrence: string | null;
}

export interface ScreenEvent {
  id: string;
  screen_id: string;
  media_item_id: string | null;
  event_type: EventType;
  triggered_by: string | null;
  occurred_at: string;
}
