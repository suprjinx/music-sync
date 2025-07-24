export interface AlbumFolder {
  path: string;
  name: string;
  artist: string;
  album: string;
  mp3_count: number;
  has_cover: boolean;
  size_mb: number;
  is_synced: boolean;
  fingerprint: string;
}

export interface AppSettings {
  lastSourceDirectory: string;
  lastTargetDirectory: string;
}