#ifndef SHUTTER_H
#define SHUTTER_H

#include <Arduino.h>

class ShutterManager {
public:
    void begin();
    bool open();
    bool close();
    void stop();
    
    bool isOpen();
    bool isClosed();
};

extern ShutterManager shutter;

#endif
