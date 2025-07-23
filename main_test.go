package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestGenerateFolderFingerprint(t *testing.T) {
	// Create temporary directory structure for testing
	tempDir, err := os.MkdirTemp("", "fingerprint_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test folder with some files
	testFolder := filepath.Join(tempDir, "TestAlbum")
	err = os.Mkdir(testFolder, 0755)
	if err != nil {
		t.Fatalf("Failed to create test folder: %v", err)
	}

	// Create test files
	testFiles := []string{"track1.mp3", "track2.mp3", "cover.jpg"}
	for _, file := range testFiles {
		filePath := filepath.Join(testFolder, file)
		f, err := os.Create(filePath)
		if err != nil {
			t.Fatalf("Failed to create test file %s: %v", file, err)
		}
		f.Close()
	}

	server := &Server{
		port:             "8080",
		fingerprintCache: make(map[string]string),
	}

	// Test fingerprint generation
	fingerprint1 := server.generateFolderFingerprint(testFolder)
	if fingerprint1 == "" {
		t.Error("Expected non-empty fingerprint")
	}

	// Test fingerprint consistency - should return same fingerprint for same folder
	fingerprint2 := server.generateFolderFingerprint(testFolder)
	if fingerprint1 != fingerprint2 {
		t.Errorf("Expected consistent fingerprints, got %s and %s", fingerprint1, fingerprint2)
	}

	// Test that fingerprint is deterministic by creating identical folder
	testFolder2 := filepath.Join(tempDir, "TestAlbum2")
	err = os.Mkdir(testFolder2, 0755)
	if err != nil {
		t.Fatalf("Failed to create second test folder: %v", err)
	}

	// Create same files in different folder
	for _, file := range testFiles {
		filePath := filepath.Join(testFolder2, file)
		f, err := os.Create(filePath)
		if err != nil {
			t.Fatalf("Failed to create test file %s: %v", file, err)
		}
		f.Close()
	}

	fingerprint3 := server.generateFolderFingerprint(testFolder2)
	if fingerprint1 == fingerprint3 {
		t.Error("Expected different fingerprints for folders with different names but same files")
	}
}

func TestFingerprintCaching(t *testing.T) {
	// Create temporary directory structure for testing
	tempDir, err := os.MkdirTemp("", "cache_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create test folder with some files
	testFolder := filepath.Join(tempDir, "CacheTestAlbum")
	err = os.Mkdir(testFolder, 0755)
	if err != nil {
		t.Fatalf("Failed to create test folder: %v", err)
	}

	// Create test files
	testFiles := []string{"track1.mp3", "track2.mp3"}
	for _, file := range testFiles {
		filePath := filepath.Join(testFolder, file)
		f, err := os.Create(filePath)
		if err != nil {
			t.Fatalf("Failed to create test file %s: %v", file, err)
		}
		f.Close()
	}

	server := &Server{
		port:             "8080",
		fingerprintCache: make(map[string]string),
	}

	// First call should generate and cache fingerprint
	fingerprint1 := server.generateFolderFingerprint(testFolder)
	if fingerprint1 == "" {
		t.Error("Expected non-empty fingerprint")
	}

	// Verify fingerprint is cached
	if cachedFingerprint, exists := server.fingerprintCache[testFolder]; !exists {
		t.Error("Expected fingerprint to be cached")
	} else if cachedFingerprint != fingerprint1 {
		t.Errorf("Expected cached fingerprint %s, got %s", fingerprint1, cachedFingerprint)
	}

	// Add a new file to the folder
	newFilePath := filepath.Join(testFolder, "track3.mp3")
	f, err := os.Create(newFilePath)
	if err != nil {
		t.Fatalf("Failed to create new test file: %v", err)
	}
	f.Close()

	// Second call should return cached value (not recalculate)
	fingerprint2 := server.generateFolderFingerprint(testFolder)
	if fingerprint1 != fingerprint2 {
		t.Error("Expected cached fingerprint to be returned even after folder content changed")
	}

	// Clear cache and regenerate - should be different now
	delete(server.fingerprintCache, testFolder)
	fingerprint3 := server.generateFolderFingerprint(testFolder)
	if fingerprint1 == fingerprint3 {
		t.Error("Expected different fingerprint after adding new file and clearing cache")
	}
}

func TestFindFolderByFingerprint(t *testing.T) {
	// Create temporary directory structure for testing
	tempDir, err := os.MkdirTemp("", "find_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	server := &Server{
		port:             "8080",
		fingerprintCache: make(map[string]string),
	}

	// Create multiple test folders
	folders := []string{"Album1", "Album2", "Album3"}
	fingerprints := make(map[string]string)

	for _, folderName := range folders {
		folderPath := filepath.Join(tempDir, folderName)
		err = os.Mkdir(folderPath, 0755)
		if err != nil {
			t.Fatalf("Failed to create folder %s: %v", folderName, err)
		}

		// Create unique files for each folder
		for i := 1; i <= 2; i++ {
			fileName := filepath.Join(folderPath, folderName+"_track"+string(rune('0'+i))+".mp3")
			f, err := os.Create(fileName)
			if err != nil {
				t.Fatalf("Failed to create file %s: %v", fileName, err)
			}
			f.Close()
		}

		fingerprints[folderName] = server.generateFolderFingerprint(folderPath)
	}

	// Test finding existing folder by fingerprint
	foundPath := server.findFolderByFingerprint(tempDir, fingerprints["Album2"])
	expectedPath := filepath.Join(tempDir, "Album2")
	if foundPath != expectedPath {
		t.Errorf("Expected to find %s, got %s", expectedPath, foundPath)
	}

	// Test with non-existent fingerprint
	nonExistentPath := server.findFolderByFingerprint(tempDir, "nonexistent_fingerprint")
	if nonExistentPath != "" {
		t.Errorf("Expected empty path for non-existent fingerprint, got %s", nonExistentPath)
	}
}

func TestCheckSyncStatus(t *testing.T) {
	// Create temporary directory structure for testing
	tempDir, err := os.MkdirTemp("", "sync_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	sourceDir := filepath.Join(tempDir, "source")
	targetDir := filepath.Join(tempDir, "target")

	err = os.MkdirAll(sourceDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create source dir: %v", err)
	}

	err = os.MkdirAll(targetDir, 0755)
	if err != nil {
		t.Fatalf("Failed to create target dir: %v", err)
	}

	server := &Server{
		port:             "8080",
		fingerprintCache: make(map[string]string),
	}

	// Create source album folder
	sourceAlbum := filepath.Join(sourceDir, "TestAlbum")
	err = os.Mkdir(sourceAlbum, 0755)
	if err != nil {
		t.Fatalf("Failed to create source album: %v", err)
	}

	// Add files to source album
	testFiles := []string{"track1.mp3", "track2.mp3", "cover.jpg"}
	for _, file := range testFiles {
		filePath := filepath.Join(sourceAlbum, file)
		f, err := os.Create(filePath)
		if err != nil {
			t.Fatalf("Failed to create test file %s: %v", file, err)
		}
		f.Close()
	}

	// Test sync status when no matching folder exists in target
	isSynced := server.checkSyncStatus(sourceAlbum, targetDir)
	if isSynced {
		t.Error("Expected false sync status when no matching folder exists")
	}

	// Create matching folder in target with same name and same files
	targetAlbum := filepath.Join(targetDir, "TestAlbum")
	err = os.Mkdir(targetAlbum, 0755)
	if err != nil {
		t.Fatalf("Failed to create target album: %v", err)
	}

	// Add same files to target album
	for _, file := range testFiles {
		filePath := filepath.Join(targetAlbum, file)
		f, err := os.Create(filePath)
		if err != nil {
			t.Fatalf("Failed to create test file %s in target: %v", file, err)
		}
		f.Close()
	}

	// Test sync status when matching folder exists (based on fingerprint)
	isSynced = server.checkSyncStatus(sourceAlbum, targetDir)
	if !isSynced {
		t.Error("Expected true sync status when matching folder exists with same fingerprint")
	}

	// Add extra file to target folder to change fingerprint
	extraFile := filepath.Join(targetAlbum, "bonus_track.mp3")
	f, err := os.Create(extraFile)
	if err != nil {
		t.Fatalf("Failed to create extra file: %v", err)
	}
	f.Close()

	// Clear cache to force recalculation
	server.fingerprintCache = make(map[string]string)

	// Test sync status when folders have different fingerprints
	isSynced = server.checkSyncStatus(sourceAlbum, targetDir)
	if isSynced {
		t.Error("Expected false sync status when folders have different fingerprints")
	}

	// Test that folders with different names but same files have different fingerprints
	differentNameFolder := filepath.Join(targetDir, "DifferentName")
	err = os.Mkdir(differentNameFolder, 0755)
	if err != nil {
		t.Fatalf("Failed to create different name folder: %v", err)
	}

	// Add same files as source album
	for _, file := range testFiles {
		filePath := filepath.Join(differentNameFolder, file)
		f, err := os.Create(filePath)
		if err != nil {
			t.Fatalf("Failed to create test file %s in different name folder: %v", file, err)
		}
		f.Close()
	}

	// Clear cache to ensure fresh calculation
	server.fingerprintCache = make(map[string]string)

	// Should not be considered synced because folder names are different
	isSynced = server.checkSyncStatus(sourceAlbum, targetDir)
	if isSynced {
		t.Error("Expected false sync status when folder has different name even with same files")
	}
}

func TestFingerprintWithEmptyFolder(t *testing.T) {
	// Create temporary directory structure for testing
	tempDir, err := os.MkdirTemp("", "empty_test")
	if err != nil {
		t.Fatalf("Failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create empty folder
	emptyFolder := filepath.Join(tempDir, "EmptyFolder")
	err = os.Mkdir(emptyFolder, 0755)
	if err != nil {
		t.Fatalf("Failed to create empty folder: %v", err)
	}

	server := &Server{
		port:             "8080",
		fingerprintCache: make(map[string]string),
	}

	// Test fingerprint generation for empty folder
	fingerprint := server.generateFolderFingerprint(emptyFolder)
	if fingerprint == "" {
		t.Error("Expected non-empty fingerprint even for empty folder")
	}

	// Create another empty folder with different name
	emptyFolder2 := filepath.Join(tempDir, "AnotherEmptyFolder")
	err = os.Mkdir(emptyFolder2, 0755)
	if err != nil {
		t.Fatalf("Failed to create second empty folder: %v", err)
	}

	fingerprint2 := server.generateFolderFingerprint(emptyFolder2)
	if fingerprint == fingerprint2 {
		t.Error("Expected different fingerprints for empty folders with different names")
	}
}