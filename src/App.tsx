import React, { useState, useEffect } from "react";
import AlbumGrid from "./components/AlbumGrid";
import DirectoryChooser from "./components/DirectoryChooser";
import NotificationModal from "./components/NotificationModal";
import { AlbumFolder, AppSettings } from "./types";

// Utility function to process items with limited concurrency
async function processConcurrentlyLimited<T, R>(
  items: T[],
  processor: (item: T) => Promise<R>,
  concurrencyLimit: number = 5
): Promise<R[]> {
  const results: R[] = [];
  
  for (let i = 0; i < items.length; i += concurrencyLimit) {
    const batch = items.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);
  }
  
  return results;
}

// Settings functions
async function loadSettings(): Promise<AppSettings> {
  try {
    const response = await fetch('/api/settings');
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.warn('Failed to load settings:', error);
  }
  return { lastSourceDirectory: '', lastTargetDirectory: '' };
}

async function saveSettings(settings: AppSettings): Promise<void> {
  try {
    await fetch('/api/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(settings),
    });
  } catch (error) {
    console.warn('Failed to save settings:', error);
  }
}

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
  const [mp3Only, setMp3Only] = useState(true);
  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "success" | "warning" | "error";
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showNotification = (title: string, message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    setNotification({
      isOpen: true,
      title,
      message,
      type,
    });
  };

  const closeNotification = () => {
    setNotification(prev => ({ ...prev, isOpen: false }));
  };

  // Load settings on component mount
  useEffect(() => {
    const initializeSettings = async () => {
      const settings = await loadSettings();
      if (settings.lastSourceDirectory) {
        setSourceDirectory(settings.lastSourceDirectory);
      }
      if (settings.lastTargetDirectory) {
        setTargetDirectory(settings.lastTargetDirectory);
      }
      // If both directories are set, automatically scan the source
      if (settings.lastSourceDirectory && settings.lastTargetDirectory) {
        scanMusicFolder(settings.lastSourceDirectory);
      }
    };
    initializeSettings();
  }, []);

  // Update sync status when target directory changes
  useEffect(() => {
    if (targetDirectory && sourceDirectory && albums.length > 0) {
      scanMusicFolder(sourceDirectory);
    }
  }, [targetDirectory]);

  const handleSourceDirectorySelect = async (path: string) => {
    setSourceDirectory(path);
    scanMusicFolder(path);
    // Save settings
    await saveSettings({
      lastSourceDirectory: path,
      lastTargetDirectory: targetDirectory,
    });
  };

  const handleTargetDirectorySelect = async (path: string) => {
    setTargetDirectory(path);
    // Save settings
    await saveSettings({
      lastSourceDirectory: sourceDirectory,
      lastTargetDirectory: path,
    });
  };

  // Filter and sort albums
  const filteredAndSortedAlbums = React.useMemo(() => {
    let filtered = albums;
    
    // Filter by MP3 only
    if (mp3Only) {
      filtered = filtered.filter(album => album.mp3_count > 0);
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(album => 
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
  }, [albums, searchTerm, sortBy, sortDirection, showOnlyOnTarget, mp3Only]);

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
        const updatedAlbums = await processConcurrentlyLimited(
          scannedAlbums,
          async (album) => {
            try {
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
            } catch (error) {
              console.warn(`Failed to check sync status for ${album.name}:`, error);
              return album;
            }
          },
          5 // Limit to 5 concurrent requests
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
      showNotification("Target Directory Required", "Please select a target directory first", "warning");
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
    showNotification("Sync Complete", summary, "success");
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
                  onClick={() => setMp3Only(!mp3Only)}
                  className={`filter-button ${mp3Only ? 'active' : ''}`}
                  title="Show only albums with MP3 files"
                >
                  🎵 MP3 Only
                </button>
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
                {mp3Only && ` (MP3 only)`}
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
      
      <NotificationModal
        isOpen={notification.isOpen}
        onClose={closeNotification}
        title={notification.title}
        message={notification.message}
        type={notification.type}
      />
    </div>
  );
}

export default App;