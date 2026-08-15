#pragma once
#include <Arduino.h>
#include <SD.h>
#include <SPI.h>
#include <driver/i2s.h>

class AudioPlayer {
public:
    void begin();
    void play(const char* filename);
    void update(); 
    void stop();
    bool isPlaying() { return _isPlaying; }

private:
    bool _isPlaying = false;
    File _audioFile;
    bool _driverInstalled = false;
};

extern AudioPlayer audioPlayer;
