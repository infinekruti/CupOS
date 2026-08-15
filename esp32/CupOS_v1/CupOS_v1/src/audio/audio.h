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

private:
    bool _isPlaying = false;
    File _audioFile;
};

extern AudioPlayer audioPlayer;
