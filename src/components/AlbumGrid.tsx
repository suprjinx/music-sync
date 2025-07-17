import React from "react";
import { AlbumFolder } from "../types";

interface AlbumGridProps {
  albums: AlbumFolder[];
  selectedAlbums: Set<string>;
  onToggleSelection: (albumPath: string, isCurrentlySynced: boolean) => void;
}

const AlbumGrid: React.FC<AlbumGridProps> = ({
  albums,
  selectedAlbums,
  onToggleSelection,
}) => {
  return (
    <div className="album-grid">
      {albums.map((album) => (
        <AlbumCard
          key={album.path}
          album={album}
          isSelected={selectedAlbums.has(album.path)}
          onToggle={() => onToggleSelection(album.path, album.is_synced)}
        />
      ))}
    </div>
  );
};

interface AlbumCardProps {
  album: AlbumFolder;
  isSelected: boolean;
  onToggle: () => void;
}

const AlbumCard: React.FC<AlbumCardProps> = ({ album, isSelected, onToggle }) => {
  const coverImagePath = album.has_cover 
    ? `/api/cover/${encodeURIComponent(album.path)}`
    : null;

  return (
    <div
      className={`album-card ${album.is_synced ? "synced" : ""} ${
        isSelected ? "selected" : ""
      }`}
      onClick={onToggle}
    >
      <div className="album-cover">
        {coverImagePath ? (
          <img src={coverImagePath} alt={`${album.album} cover`} />
        ) : (
          <div className="no-cover">
            <span>♫</span>
          </div>
        )}
        {album.is_synced && <div className="synced-badge">✓</div>}
        {isSelected && <div className="selected-badge">✓</div>}
      </div>
      <div className="album-info">
        <div className="artist-name">{album.artist}</div>
        <div className="album-name">{album.album}</div>
        <div className="album-stats">
          {album.mp3_count} tracks • {album.size_mb.toFixed(1)} MB
        </div>
      </div>
    </div>
  );
};

export default AlbumGrid;