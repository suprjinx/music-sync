#!/bin/bash

echo "🎵 Building Music Sync..."

# Build React frontend
echo "📦 Building React frontend..."
npm run build

# Create dist folder if it doesn't exist
mkdir -p dist

# Build Go backend for current platform
echo "🔧 Building Go backend..."
go build -o dist/music-sync main.go

# Build for Windows (if on non-Windows platform)
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "cygwin" ]]; then
    echo "🪟 Building for Windows..."
    GOOS=windows GOARCH=amd64 go build -o dist/music-sync.exe main.go
fi

# Build for Linux (if on non-Linux platform)
if [[ "$OSTYPE" != "linux-gnu"* ]]; then
    echo "🐧 Building for Linux..."
    GOOS=linux GOARCH=amd64 go build -o dist/music-sync-linux main.go
fi

# Build for macOS (if on non-macOS platform)
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "🍎 Building for macOS..."
    GOOS=darwin GOARCH=amd64 go build -o dist/music-sync-macos main.go
fi

echo "✅ Build complete!"
echo "📁 Executables in dist folder:"
ls -la dist/music-sync* 2>/dev/null || echo "No executables found"
echo ""
echo "🚀 To run:"
echo "  ./dist/music-sync          (current platform)"
echo "  ./dist/music-sync.exe      (Windows)"
echo "  ./dist/music-sync-linux    (Linux)"
echo "  ./dist/music-sync-macos    (macOS)"