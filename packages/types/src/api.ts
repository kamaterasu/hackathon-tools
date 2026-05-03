import type { MediaItem, Playlist, PlaylistItem, Screen, Schedule } from './db.js';

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

export interface UploadMediaResponse {
  media: MediaItem;
  jobId?: string;
}

export interface PlaylistWithItems extends Playlist {
  items: Array<PlaylistItem & { media: MediaItem }>;
}

export interface ScreenWithState extends Screen {
  current_playlist: PlaylistWithItems | null;
  active_schedule: Schedule | null;
}

export interface CreateScreenResponse extends Screen {
  api_key: string;
}

export type CommandAction = 'play' | 'pause' | 'next' | 'prev' | 'goto' | 'assign';

export interface ScreenCommand {
  action: CommandAction;
  payload?: {
    index?: number;
    playlist_id?: string;
  };
}

export interface PlayerState {
  screen: Screen;
  playlist: PlaylistWithItems | null;
  current_index: number;
}

export interface AddPlaylistItemBody {
  media_item_id: string;
  position?: number;
  duration_seconds?: number;
  transition?: 'fade' | 'cut' | 'slide';
}

export interface UpdatePlaylistBody {
  name?: string;
  loop?: boolean;
  items?: Array<{ id: string; position: number; duration_seconds?: number }>;
}
