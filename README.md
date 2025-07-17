# Music Sync

A web-based application for syncing music collections between drives with visual album covers.

## Features

- **Visual Album Browser**: Grid view with album covers (cover.jpg)
- **Smart Scanning**: Automatically detects folders containing MP3 files
- **Click-to-Sync**: Single click to select/deselect albums for sync
- **Cross-Platform**: Built with Go backend + React frontend
- **Self-Contained**: Single executable with embedded web UI
- **Fast Performance**: Efficient file system operations

## Tech Stack

- **Frontend**: React with TypeScript
- **Backend**: Go with HTTP server
- **UI**: Custom CSS with grid layout
- **File System**: Native Go file operations
- **Distribution**: Single executable with embedded assets

## Development

### Prerequisites

- Go (v1.16 or higher)
- Node.js (v18 or higher)
- npm or yarn

### Setup

1. Clone the repository
2. Install frontend dependencies:
   ```bash
   npm install
   ```

3. Run in development mode:
   ```bash
   ./run.sh
   ```

### Building

To build for all platforms:
```bash
./build.sh
```

To build for current platform only:
```bash
npm run build
mkdir -p dist
go build -o dist/music-sync main.go
```

## Usage

1. **Run the executable**: `./dist/music-sync`
2. **Open browser**: Application will print URL and attempt to open browser automatically
3. **Navigate manually**: Go to `http://localhost:8080` if browser doesn't open
4. **Select Source Directory**: Choose your main music collection using file picker
5. **Select Target Directory**: Choose USB drive or target location
6. **Browse Albums**: View your collection as album covers
7. **Select for Sync**: Click albums to toggle sync selection
8. **Sync**: Click "Sync Selected" to copy chosen albums

## File Structure

- `src/` - React frontend source
- `dist/` - React build output (embedded in Go binary)
- `main.go` - Go backend with embedded static files
- `build.sh` - Cross-platform build script
- `run.sh` - Development runner script

## Album Organization

- Albums should be in folders with MP3 files
- Optional `cover.jpg` for album artwork
- Supports "Artist - Album" folder naming convention
- Automatically calculates file counts and sizes

## Distribution

The built executable is completely self-contained and includes:
- Go HTTP server
- React web UI (embedded)
- All static assets
- No external dependencies required

## Cross-Platform Support

- **Windows**: `dist/music-sync.exe`
- **macOS**: `dist/music-sync-macos`
- **Linux**: `dist/music-sync-linux`

All platforms supported through single codebase with Go's cross-compilation.

## Build Output

After running `./build.sh`, you'll find the executables in the `dist/` folder:
- All React build files (embedded in executables)
- Cross-platform binaries ready for distribution