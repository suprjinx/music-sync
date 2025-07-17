package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

//go:embed dist/*
var staticFiles embed.FS

type AlbumFolder struct {
	Path      string  `json:"path"`
	Name      string  `json:"name"`
	Artist    string  `json:"artist"`
	Album     string  `json:"album"`
	Mp3Count  int     `json:"mp3_count"`
	HasCover  bool    `json:"has_cover"`
	SizeMB    float64 `json:"size_mb"`
	IsSynced  bool    `json:"is_synced"`
}

type DirectoryItem struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	IsDirectory bool   `json:"isDirectory"`
}

type Server struct {
	port string
}

func main() {
	server := &Server{port: "8080"}
	
	// Print URL to console
	fmt.Printf("🎵 Music Sync Server starting...\n")
	fmt.Printf("📡 Server URL: http://localhost:%s\n", server.port)
	
	// Try to open browser
	go openBrowser(fmt.Sprintf("http://localhost:%s", server.port))
	
	// Set up routes
	http.HandleFunc("/api/scan", server.handleScan)
	http.HandleFunc("/api/drives", server.handleDrives)
	http.HandleFunc("/api/browse", server.handleBrowse)
	http.HandleFunc("/api/check-sync", server.handleCheckSync)
	http.HandleFunc("/api/sync", server.handleSync)
	http.HandleFunc("/api/unsync", server.handleUnsync)
	http.HandleFunc("/api/cover/", server.handleCover)
	
	// Serve static files (React build) from embedded files
	distFS, err := fs.Sub(staticFiles, "dist")
	if err != nil {
		log.Fatal(err)
	}
	
	fsHandler := http.FileServer(http.FS(distFS))
	http.Handle("/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// For SPA routing, serve index.html for non-API routes
		if r.URL.Path != "/" && !strings.HasPrefix(r.URL.Path, "/api/") && !strings.HasPrefix(r.URL.Path, "/assets/") {
			indexFile, err := staticFiles.ReadFile("dist/index.html")
			if err != nil {
				http.Error(w, "File not found", http.StatusNotFound)
				return
			}
			w.Header().Set("Content-Type", "text/html")
			w.Write(indexFile)
			return
		}
		fsHandler.ServeHTTP(w, r)
	}))
	
	fmt.Printf("🚀 Server running on http://localhost:%s\n", server.port)
	log.Fatal(http.ListenAndServe(":"+server.port, nil))
}

func openBrowser(url string) {
	var err error
	switch runtime.GOOS {
	case "linux":
		err = exec.Command("xdg-open", url).Start()
	case "windows":
		err = exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
	case "darwin":
		err = exec.Command("open", url).Start()
	}
	if err != nil {
		fmt.Printf("⚠️  Could not open browser automatically: %v\n", err)
		fmt.Printf("🌐 Please open http://localhost:8080 manually\n")
	}
}

func (s *Server) handleScan(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var req struct {
		Directory string `json:"directory"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	albums := scanMusicFolders(req.Directory)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(albums)
}

func (s *Server) handleDrives(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	drives := getDrives()
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(drives)
}

func (s *Server) handleBrowse(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var req struct {
		Path string `json:"path"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	items, err := browseDirectory(req.Path)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}

func (s *Server) handleCheckSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var req struct {
		SourcePath      string `json:"sourcePath"`
		TargetDirectory string `json:"targetDirectory"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	isSynced := checkSyncStatus(req.SourcePath, req.TargetDirectory)
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"synced": isSynced})
}

func (s *Server) handleSync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var req struct {
		SourcePath      string `json:"sourcePath"`
		TargetDirectory string `json:"targetDirectory"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	result, err := syncAlbum(req.SourcePath, req.TargetDirectory)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"result": result})
}

func (s *Server) handleUnsync(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var req struct {
		TargetDirectory string `json:"targetDirectory"`
		AlbumName       string `json:"albumName"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	result, err := unsyncAlbum(req.TargetDirectory, req.AlbumName)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"result": result})
}

func (s *Server) handleCover(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract album path from URL
	albumPath := r.URL.Path[len("/api/cover/"):]
	if albumPath == "" {
		http.Error(w, "Album path required", http.StatusBadRequest)
		return
	}
	
	// Construct cover image path
	coverPath := filepath.Join(albumPath, "cover.jpg")
	
	// Check if file exists
	if _, err := os.Stat(coverPath); os.IsNotExist(err) {
		http.Error(w, "Cover image not found", http.StatusNotFound)
		return
	}
	
	// Serve the image file
	w.Header().Set("Content-Type", "image/jpeg")
	http.ServeFile(w, r, coverPath)
}

func scanMusicFolders(directory string) []AlbumFolder {
	var albums []AlbumFolder
	
	err := filepath.WalkDir(directory, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil // Skip errors
		}
		
		if d.IsDir() && path != directory {
			// Check if this directory contains MP3 files
			mp3Count := 0
			dirEntries, err := os.ReadDir(path)
			if err != nil {
				return nil
			}
			
			for _, entry := range dirEntries {
				if !entry.IsDir() && strings.HasSuffix(strings.ToLower(entry.Name()), ".mp3") {
					mp3Count++
				}
			}
			
			if mp3Count > 0 {
				folderName := filepath.Base(path)
				parentFolderName := filepath.Base(filepath.Dir(path))
				artist, album := parseArtistAndAlbum(parentFolderName, folderName)
				
				// Check for cover.jpg
				coverPath := filepath.Join(path, "cover.jpg")
				hasCover := false
				if _, err := os.Stat(coverPath); err == nil {
					hasCover = true
				}
				
				// Calculate folder size
				sizeMB := calculateFolderSize(path)
				
				albums = append(albums, AlbumFolder{
					Path:     path,
					Name:     folderName,
					Artist:   artist,
					Album:    album,
					Mp3Count: mp3Count,
					HasCover: hasCover,
					SizeMB:   sizeMB,
					IsSynced: false,
				})
			}
		}
		
		return nil
	})
	
	if err != nil {
		log.Printf("Error scanning directory: %v", err)
	}
	
	return albums
}

func getDrives() []string {
	var drives []string
	
	if runtime.GOOS == "windows" {
		for drive := 'A'; drive <= 'Z'; drive++ {
			drivePath := fmt.Sprintf("%c:\\", drive)
			if _, err := os.Stat(drivePath); err == nil {
				drives = append(drives, drivePath)
			}
		}
	} else {
		// Unix-like systems
		drives = append(drives, "/")
		if _, err := os.Stat("/Volumes"); err == nil {
			drives = append(drives, "/Volumes")
		}
	}
	
	return drives
}

func checkSyncStatus(sourcePath, targetDirectory string) bool {
	folderName := filepath.Base(sourcePath)
	targetPath := filepath.Join(targetDirectory, folderName)
	
	if _, err := os.Stat(targetPath); err == nil {
		return true
	}
	return false
}

func syncAlbum(sourcePath, targetDirectory string) (string, error) {
	folderName := filepath.Base(sourcePath)
	targetPath := filepath.Join(targetDirectory, folderName)
	
	// Create target directory
	if err := os.MkdirAll(targetPath, 0755); err != nil {
		return "", fmt.Errorf("failed to create target directory: %v", err)
	}
	
	// Copy all files
	if err := copyDirectory(sourcePath, targetPath); err != nil {
		return "", fmt.Errorf("failed to copy files: %v", err)
	}
	
	return fmt.Sprintf("Successfully synced %s to %s", folderName, targetPath), nil
}

func unsyncAlbum(targetDirectory, albumName string) (string, error) {
	targetPath := filepath.Join(targetDirectory, albumName)
	
	if _, err := os.Stat(targetPath); os.IsNotExist(err) {
		return "", fmt.Errorf("album %s not found in target directory", albumName)
	}
	
	if err := os.RemoveAll(targetPath); err != nil {
		return "", fmt.Errorf("failed to remove album: %v", err)
	}
	
	return fmt.Sprintf("Successfully removed %s", albumName), nil
}

func parseArtistAndAlbum(parentFolderName, albumFolderName string) (string, string) {
	// Strategy 1: Parent folder is artist, album folder is album
	// Example: "Beatles/Abbey Road/" -> artist: "Beatles", album: "Abbey Road"
	if parentFolderName != "" && !isRootLevelFolder(parentFolderName) {
		return parentFolderName, albumFolderName
	}
	
	// Strategy 2: Album folder contains "Artist - Album" format
	if idx := strings.Index(albumFolderName, " - "); idx != -1 {
		artist := strings.TrimSpace(albumFolderName[:idx])
		album := strings.TrimSpace(albumFolderName[idx+3:])
		if artist != "" && album != "" {
			return artist, album
		}
	}
	
	// Strategy 3: Album folder contains "Artist-Album" format (no spaces)
	if idx := strings.Index(albumFolderName, "-"); idx != -1 {
		artist := strings.TrimSpace(albumFolderName[:idx])
		album := strings.TrimSpace(albumFolderName[idx+1:])
		if artist != "" && album != "" {
			return artist, album
		}
	}
	
	// Strategy 4: Album folder contains "Artist_Album" format (underscore)
	if idx := strings.Index(albumFolderName, "_"); idx != -1 {
		artist := strings.TrimSpace(albumFolderName[:idx])
		album := strings.TrimSpace(albumFolderName[idx+1:])
		if artist != "" && album != "" {
			return artist, album
		}
	}
	
	// Default: Unknown artist, album folder name as album
	return "Unknown Artist", albumFolderName
}

func isRootLevelFolder(folderName string) bool {
	// Check if this is a root-level folder that shouldn't be treated as an artist
	rootFolders := []string{"Music", "music", "Songs", "songs", "Audio", "audio", "Media", "media"}
	
	for _, root := range rootFolders {
		if strings.EqualFold(folderName, root) {
			return true
		}
	}
	
	return false
}

func calculateFolderSize(path string) float64 {
	var size int64
	
	err := filepath.WalkDir(path, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if !d.IsDir() {
			info, err := d.Info()
			if err != nil {
				return nil
			}
			size += info.Size()
		}
		return nil
	})
	
	if err != nil {
		log.Printf("Error calculating folder size: %v", err)
	}
	
	return float64(size) / 1024 / 1024 // Convert to MB
}

func copyDirectory(src, dst string) error {
	return filepath.WalkDir(src, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		
		relPath, err := filepath.Rel(src, path)
		if err != nil {
			return err
		}
		
		dstPath := filepath.Join(dst, relPath)
		
		if d.IsDir() {
			return os.MkdirAll(dstPath, 0755)
		}
		
		srcFile, err := os.Open(path)
		if err != nil {
			return err
		}
		defer srcFile.Close()
		
		dstFile, err := os.Create(dstPath)
		if err != nil {
			return err
		}
		defer dstFile.Close()
		
		_, err = srcFile.WriteTo(dstFile)
		return err
	})
}

func browseDirectory(path string) ([]DirectoryItem, error) {
	var items []DirectoryItem
	
	entries, err := os.ReadDir(path)
	if err != nil {
		return nil, err
	}
	
	for _, entry := range entries {
		// Skip hidden files/directories
		if strings.HasPrefix(entry.Name(), ".") {
			continue
		}
		
		fullPath := filepath.Join(path, entry.Name())
		items = append(items, DirectoryItem{
			Name:        entry.Name(),
			Path:        fullPath,
			IsDirectory: entry.IsDir(),
		})
	}
	
	return items, nil
}