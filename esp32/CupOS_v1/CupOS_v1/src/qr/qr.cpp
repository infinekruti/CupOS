#include "qr.h"
#include "../config/config.h"

QRScanner::QRScanner(uint8_t rxPin, uint8_t txPin, unsigned long baud)
    : _serial(2) // ESP32 HardwareSerial port 2
{
    _serial.begin(baud, SERIAL_8N1, rxPin, txPin);
}

void QRScanner::begin() {
    // Initialization handled in constructor
}

bool QRScanner::available() {
    return _serial.available() > 0;
}

String QRScanner::read() {
    String txt = _serial.readStringUntil('\n');
    txt.trim();
    return txt;
}

int QRScanner::readRaw() {
    return _serial.read();
}
