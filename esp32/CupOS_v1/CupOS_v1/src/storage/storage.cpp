#include "storage.h"
#include "../config/config.h"
#include "../diagnostics/diagnostics.h"

StorageManager storage;
void StorageManager::begin() {
    // Exactly match the user's working code sequence
    delay(500);
    // Full SPI bus reset: TFT display leaves the bus in its own state.
    // We must tear it down completely and bring it back fresh for the SD card.
    SPI.end();
    delay(20);
    SPI.begin(18, 19, 23); // Force exact pins 18, 19, 23
    delay(100);
    
    // Retry SD mount up to 3 times — cheap modules need time to stabilize
    bool mounted = false;
    for (int attempt = 1; attempt <= 3; attempt++) {
        Serial.printf("SD Mount attempt %d/3...\n", attempt);
        // Use default SPI instance — do NOT pass the shared SPI bus object.
        // Passing SPI explicitly causes bus contention with the TFT display and breaks the mount!
        if (SD.begin(13)) {
            mounted = true;
            break;
        }
        SD.end(); // Clean up failed mount
        delay(500 * attempt); // Increasing delay between retries
    }
    
    if (!mounted) {
        diagnostics.error(ModuleID::System, "SD Card Mount Failed after 3 attempts!");
    } else {
        diagnostics.info(ModuleID::System, "SD Card Mounted");
        
        // CRITICAL WORKAROUND: Force ESP32 VFS to cache Long File Names!
        // Without iterating the root directory once on mount, direct open() 
        // calls to mixed-case files (like CupOS.wav) will instantly fail.
        File root = SD.open("/");
        if (root) {
            File f = root.openNextFile();
            while (f) {
                Serial.printf("  SD File: %s (%d bytes)\n", f.name(), f.size());
                f.close();
                f = root.openNextFile();
            }
            root.close();
        }
    }
}

bool StorageManager::exists(const char* path) {
    return SD.exists(path);
}

bool StorageManager::writeFile(const char* path, const char* message) {
    File file = SD.open(path, FILE_WRITE);
    if (!file) {
        diagnostics.error(ModuleID::System, (String("Failed to open file for writing: ") + path).c_str());
        return false;
    }
    bool success = file.print(message);
    file.flush(); // Force physical write
    file.close();
    return success;
}

bool StorageManager::appendFile(const char* path, const char* message) {
    File file = SD.open(path, FILE_APPEND);
    if (!file) {
        diagnostics.error(ModuleID::System, (String("Failed to open file for appending: ") + path).c_str());
        return false;
    }
    bool success = file.print(message);
    file.flush(); // Force physical write
    file.close();
    return success;
}

String StorageManager::readFile(const char* path) {
    File file = SD.open(path);
    if (!file) {
        diagnostics.error(ModuleID::System, (String("Failed to open file for reading: ") + path).c_str());
        return "";
    }
    String out = "";
    while (file.available()) {
        out += (char)file.read();
    }
    file.close();
    return out;
}
