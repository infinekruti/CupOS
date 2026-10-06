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
    void setVolume(float volume) { _volume = constrain(volume, 0.0f, 1.0f); }

private:
    bool _isPlaying = false;
    File _audioFile;
    bool _driverInstalled = false;
    uint16_t _bitsPerSample = 16;
    float _volume = 0.3f; // Default to 30% volume
};

extern AudioPlayer audioPlayer;
