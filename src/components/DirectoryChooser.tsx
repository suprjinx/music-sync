import React, { useState, useEffect } from "react";

interface DirectoryChooserProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (path: string) => void;
  title: string;
}

interface DirectoryItem {
  name: string;
  path: string;
  isDirectory: boolean;
}

const DirectoryChooser: React.FC<DirectoryChooserProps> = ({
  isOpen,
  onClose,
  onSelect,
  title,
}) => {
  const [currentPath, setCurrentPath] = useState("");
  const [drives, setDrives] = useState<string[]>([]);
  const [directories, setDirectories] = useState<DirectoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadDrives();
    }
  }, [isOpen]);

  const loadDrives = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/drives');
      if (response.ok) {
        const driveList = await response.json();
        setDrives(driveList);
      }
    } catch (error) {
      console.error("Error loading drives:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadDirectory = async (path: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/browse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ path }),
      });
      
      if (response.ok) {
        const items = await response.json();
        setDirectories(items);
        setCurrentPath(path);
      }
    } catch (error) {
      console.error("Error loading directory:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDriveClick = (drive: string) => {
    loadDirectory(drive);
  };

  const handleDirectoryClick = (item: DirectoryItem) => {
    if (item.isDirectory) {
      loadDirectory(item.path);
    }
  };

  const handleSelectCurrent = () => {
    onSelect(currentPath);
    onClose();
  };

  const handleGoUp = () => {
    const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
    if (parentPath !== currentPath) {
      loadDirectory(parentPath);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="modal-body">
          <div className="current-path">
            <strong>Current Path:</strong> {currentPath || "Select a drive"}
          </div>
          
          {loading && <div className="loading">Loading...</div>}
          
          {!currentPath && (
            <div className="drives-section">
              <h4>Available Drives:</h4>
              <div className="drives-list">
                {drives.map((drive) => (
                  <button
                    key={drive}
                    className="drive-item"
                    onClick={() => handleDriveClick(drive)}
                  >
                    📁 {drive}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {currentPath && (
            <div className="directory-section">
              <div className="directory-controls">
                <button className="nav-button" onClick={handleGoUp}>
                  ⬆️ Go Up
                </button>
                <button className="nav-button" onClick={handleSelectCurrent}>
                  ✅ Select Current Directory
                </button>
              </div>
              
              <div className="directory-list">
                {directories.map((item) => (
                  <button
                    key={item.path}
                    className={`directory-item ${item.isDirectory ? 'directory' : 'file'}`}
                    onClick={() => handleDirectoryClick(item)}
                    disabled={!item.isDirectory}
                  >
                    {item.isDirectory ? '📁' : '📄'} {item.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DirectoryChooser;