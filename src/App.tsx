import React, { useState, useEffect } from "react";
import AlbumGrid from "./components/AlbumGrid";
import DirectoryChooser from "./components/DirectoryChooser";
import { AlbumFolder } from "./types";

function App() {
  const [albums, setAlbums] = useState<AlbumFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [sourceDirectory, setSourceDirectory] = useState("");
  const [targetDirectory, setTargetDirectory] = useState("");
  const [selectedAlbums, setSelectedAlbums] = useState<Set<string>>(new Set());
  const [showSourceChooser, setShowSourceChooser] = useState(false);
  const [showTargetChooser, setShowTargetChooser] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"artist" | "album" | "date">("artist");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showOnlyOnTarget, setShowOnlyOnTarget] = useState(false);

  // Update sync status when target directory changes
  useEffect(() => {
    if (targetDirectory && sourceDirectory && albums.length > 0) {
      scanMusicFolder(sourceDirectory);
    }
  }, [targetDirectory]);

  const handleSourceDirectorySelect = (path: string) => {
    setSourceDirectory(path);
    scanMusicFolder(path);
  };

  const handleTargetDirectorySelect = (path: string) => {
    setTargetDirectory(path);
  };

  // Filter and sort albums
  const filteredAndSortedAlbums = React.useMemo(() => {
    let filtered = albums;
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = albums.filter(album => 
        album.artist.toLowerCase().includes(term) ||
        album.album.toLowerCase().includes(term) ||
        album.name.toLowerCase().includes(term)
      );
    }
    
    // Filter by sync status (show only on target)
    if (showOnlyOnTarget) {
      filtered = filtered.filter(album => album.is_synced);
    }
    
    // Sort albums
    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case "artist":
          comparison = a.artist.localeCompare(b.artist) || a.album.localeCompare(b.album);
          break;
        case "album":
          comparison = a.album.localeCompare(b.album);
          break;
        case "date":
          // For now, sort by folder name as a proxy for date
          comparison = a.name.localeCompare(b.name);
          break;
        default:
          comparison = 0;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });
    
    return sorted;
  }, [albums, searchTerm, sortBy, sortDirection, showOnlyOnTarget]);

  // Calculate selection stats
  const selectionStats = React.useMemo(() => {
    const selectedAlbumData = albums.filter(album => selectedAlbums.has(album.path));
    const totalSize = selectedAlbumData.reduce((sum, album) => sum + album.size_mb, 0);
    const count = selectedAlbumData.length;
    
    return {
      count,
      totalSizeMB: totalSize,
      totalSizeGB: totalSize / 1024
    };
  }, [albums, selectedAlbums]);

  const scanMusicFolder = async (directory: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ directory }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const scannedAlbums: AlbumFolder[] = await response.json();
      
      // Check sync status for each album if target directory is selected
      if (targetDirectory) {
        const updatedAlbums = await Promise.all(
          scannedAlbums.map(async (album) => {
            const syncResponse = await fetch('/api/check-sync', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                sourcePath: album.path,
                targetDirectory,
              }),
            });
            
            if (syncResponse.ok) {
              const syncData = await syncResponse.json();
              return { ...album, is_synced: syncData.synced };
            }
            return album;
          })
        );
        setAlbums(updatedAlbums);
      } else {
        setAlbums(scannedAlbums);
      }
    } catch (error) {
      console.error("Error scanning music folders:", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleAlbumSelection = (albumPath: string, isCurrentlySynced: boolean) => {
    const newSelected = new Set(selectedAlbums);
    
    if (newSelected.has(albumPath)) {
      newSelected.delete(albumPath);
    } else {
      newSelected.add(albumPath);
    }
    
    setSelectedAlbums(newSelected);
  };

  const syncSelectedAlbums = async () => {
    if (!targetDirectory) {
      alert("Please select a target directory first");
      return;
    }

    setLoading(true);
    const results = [];
    let syncedCount = 0;
    let unsyncedCount = 0;
    const totalAlbums = selectedAlbums.size;
    let currentIndex = 0;
    
    setSyncProgress({ current: 0, total: totalAlbums });
    
    for (const albumPath of selectedAlbums) {
      currentIndex++;
      setSyncProgress({ current: currentIndex, total: totalAlbums });
      const album = albums.find(a => a.path === albumPath);
      if (!album) continue;
      
      try {
        if (album.is_synced) {
          // Remove from sync (unsync)
          const response = await fetch('/api/unsync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              targetDirectory,
              albumName: album.name,
            }),
          });
          
          if (response.ok) {
            unsyncedCount++;
            results.push(`🗑️ Removed: ${album.artist} - ${album.album}`);
          } else {
            results.push(`❌ Error removing ${album.name}: ${response.statusText}`);
          }
        } else {
          // Sync to target
          const response = await fetch('/api/sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              sourcePath: album.path,
              targetDirectory,
            }),
          });
          
          if (response.ok) {
            syncedCount++;
            results.push(`✅ Synced: ${album.artist} - ${album.album}`);
          } else {
            results.push(`❌ Error syncing ${album.name}: ${response.statusText}`);
          }
        }
      } catch (error) {
        console.error(`Error processing ${album.name}:`, error);
        results.push(`❌ Error: ${album.name} - ${error}`);
      }
    }
    
    // Clear selection and rescan to update sync status
    setSelectedAlbums(new Set());
    if (sourceDirectory) {
      await scanMusicFolder(sourceDirectory);
    }
    
    setLoading(false);
    setSyncProgress({ current: 0, total: 0 });
    
    // Show summary
    const summary = `Sync Complete!\n\n${syncedCount} albums added to target\n${unsyncedCount} albums removed from target\n\nDetails:\n${results.join('\n')}`;
    alert(summary);
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Music Sync</h1>
        <div className="directory-controls">
          <div className="directory-selector">
            <label>Source Directory:</label>
            <button onClick={() => setShowSourceChooser(true)} className="directory-button">
              {sourceDirectory || "Choose Music Collection"}
            </button>
            {sourceDirectory && <div className="selected-path">{sourceDirectory}</div>}
          </div>
          <div className="directory-selector">
            <label>Target Directory:</label>
            <button onClick={() => setShowTargetChooser(true)} className="directory-button">
              {targetDirectory || "Choose Sync Target"}
            </button>
            {targetDirectory && <div className="selected-path">{targetDirectory}</div>}
          </div>
        </div>
        {selectedAlbums.size > 0 && (
          <div className="sync-controls">
            <div className="selection-stats">
              <span className="selection-count">{selectionStats.count} albums selected</span>
              <span className="selection-size">
                {selectionStats.totalSizeGB >= 1 
                  ? `${selectionStats.totalSizeGB.toFixed(2)} GB`
                  : `${selectionStats.totalSizeMB.toFixed(0)} MB`
                }
              </span>
            </div>
            <button onClick={syncSelectedAlbums} className="sync-button">
              {Array.from(selectedAlbums).some(path => 
                albums.find(a => a.path === path)?.is_synced
              ) ? "Sync/Unsync Selected" : "Sync Selected"}
            </button>
          </div>
        )}
      </header>

      <main className="app-main">
        {loading ? (
          <div className="loading">
            {syncProgress.total > 0 ? (
              <div className="sync-progress">
                <div>Syncing albums... {syncProgress.current} of {syncProgress.total}</div>
                <div className="progress-bar">
                  <div 
                    className="progress-fill" 
                    style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              "Scanning music collection..."
            )}
          </div>
        ) : albums.length > 0 ? (
          <>
            <div className="album-controls">
              <div className="search-section">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search albums or artists..."
                  className="search-input"
                />
              </div>
              <div className="sort-section">
                <label>Sort by:</label>
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value as "artist" | "album" | "date")}
                  className="sort-select"
                >
                  <option value="artist">Artist</option>
                  <option value="album">Album</option>
                  <option value="date">Date Added</option>
                </select>
                <button 
                  onClick={() => setSortDirection(sortDirection === "asc" ? "desc" : "asc")}
                  className="sort-direction-btn"
                  title={sortDirection === "asc" ? "Currently ascending - click for descending" : "Currently descending - click for ascending"}
                >
                  {sortDirection === "asc" ? "↑" : "↓"}
                </button>
              </div>
              <div className="filter-section">
                <button 
                  onClick={() => setShowOnlyOnTarget(!showOnlyOnTarget)}
                  className={`filter-button ${showOnlyOnTarget ? 'active' : ''}`}
                  title="Show only albums that exist on target"
                >
                  📁 On Target
                </button>
              </div>
              <div className="album-count">
                {filteredAndSortedAlbums.length} of {albums.length} albums
                {showOnlyOnTarget && ` (synced only)`}
              </div>
            </div>
            <AlbumGrid
              albums={filteredAndSortedAlbums}
              selectedAlbums={selectedAlbums}
              onToggleSelection={toggleAlbumSelection}
            />
          </>
        ) : (
          <div className="empty-state">
            Select a directory to scan for music albums
          </div>
        )}
      </main>
      
      <DirectoryChooser
        isOpen={showSourceChooser}
        onClose={() => setShowSourceChooser(false)}
        onSelect={handleSourceDirectorySelect}
        title="Select Source Directory"
      />
      
      <DirectoryChooser
        isOpen={showTargetChooser}
        onClose={() => setShowTargetChooser(false)}
        onSelect={handleTargetDirectorySelect}
        title="Select Target Directory"
      />
    </div>
  );
}

export default App;