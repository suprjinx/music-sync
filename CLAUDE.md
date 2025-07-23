# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Music Sync is a web-based application for syncing music collections between drives with visual album covers. It's built as a hybrid Go backend + React frontend application that compiles to a single self-contained executable.

## Architecture

- **Backend**: Go HTTP server (`main.go`) that embeds the React frontend using `//go:embed`
- **Frontend**: React with TypeScript using Vite as the build tool
- **API**: RESTful endpoints for scanning, syncing, and managing music collections
- **File Operations**: Native Go file system operations for scanning and copying
- **Album Detection**: Smart scanning that detects folders containing MP3 files and extracts artist/album metadata
- **Fingerprinting**: SHA256-based folder fingerprinting for sync state management

## Key Components

### Backend (Go)
- **Server struct**: Handles HTTP routing and maintains fingerprint cache
- **API Endpoints**: `/api/scan`, `/api/sync`, `/api/unsync`, `/api/check-sync`, `/api/browse`, `/api/drives`, `/api/cover/`
- **AlbumFolder struct**: Core data model representing music album folders
- **Fingerprinting**: Uses folder name + file list to create unique identifiers for sync matching

### Frontend (React)
- **App.tsx**: Main application component handling state and API calls
- **AlbumGrid.tsx**: Grid view component for displaying albums with covers
- **DirectoryChooser.tsx**: File browser component for selecting directories
- **types.ts**: TypeScript interfaces matching Go structs

## Development Commands

### Development Mode
```bash
./run.sh
```
This builds the React frontend and runs the Go server in development mode.

### Building
```bash
./build.sh
```
Cross-platform build that creates executables for Windows, Linux, and macOS in the `dist/` folder.

### Manual Build (current platform)
```bash
npm run build
mkdir -p dist
go build -o dist/music-sync main.go
```

### Frontend Only
```bash
npm run dev      # Vite dev server (port 1420)
npm run build    # Production build to dist/
npm run preview  # Preview production build
```

## Application Flow

1. **Directory Selection**: User selects source (music collection) and target (sync destination) directories
2. **Scanning**: Backend scans source directory for folders containing MP3 files
3. **Album Detection**: Parses folder structure to extract artist/album information using multiple strategies
4. **Sync Status**: Checks if albums exist on target using fingerprint matching
5. **Selection & Sync**: User selects albums to sync/unsync, backend performs file operations

## Album Organization Logic

The application supports multiple folder naming conventions:
- `Artist/Album/` - Parent folder as artist, subfolder as album
- `Artist - Album/` - Folder name with dash separator
- `Artist-Album/` - Folder name with dash (no spaces)
- `Artist_Album/` - Folder name with underscore

Albums must contain MP3 files to be detected. Optional `cover.jpg` files are used for album artwork.

## File Structure

- `src/` - React frontend source code
- `dist/` - Build output (embedded in Go binary)
- `main.go` - Go backend with embedded static files
- `build.sh` - Cross-platform build script
- `run.sh` - Development mode script
- `vite.config.ts` - Vite configuration
- `tsconfig.json` - TypeScript configuration

## Key Features

- **Visual Album Browser**: Grid view with album covers from `cover.jpg` files
- **Smart Sync Detection**: Fingerprint-based matching to detect existing albums on target
- **Batch Operations**: Select multiple albums for sync/unsync operations
- **Cross-Platform**: Single executable works on Windows, Linux, and macOS
- **Search & Filter**: Filter albums by artist/album name, sort by various criteria
- **Progress Tracking**: Real-time progress display during sync operations

## Testing

No specific test framework is configured. To test:
1. Build the application using `./build.sh`
2. Run the executable from `dist/`
3. Test with actual music directories containing MP3 files
4. Verify sync operations between different drives/directories