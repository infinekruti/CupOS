#ifndef STORAGE_H
#define STORAGE_H

#include <Arduino.h>
#include <SD.h>
#include <SPI.h>

class StorageManager {
public:
    void begin();
    bool exists(const char* path);
    bool writeFile(const char* path, const char* message);
    bool appendFile(const char* path, const char* message);
    String readFile(const char* path);
};

extern StorageManager storage;

#endif
