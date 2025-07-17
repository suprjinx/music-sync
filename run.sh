#!/bin/bash

echo "🎵 Starting Music Sync in development mode..."

# Build React frontend
echo "📦 Building React frontend..."
npm run build

# Create dist folder if it doesn't exist
mkdir -p dist

# Run Go backend
echo "🚀 Starting Go backend..."
go run main.go