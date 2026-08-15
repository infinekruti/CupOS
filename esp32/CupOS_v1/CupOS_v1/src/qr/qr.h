#pragma once
#include <Arduino.h>

class QRScanner {
public:
    QRScanner(uint8_t rxPin, uint8_t txPin, unsigned long baud);
    void begin();
    bool available();
    String read();
    int readRaw();
private:
    HardwareSerial _serial;
};
