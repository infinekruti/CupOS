#ifndef DISPLAY_H
#define DISPLAY_H

#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include "../config/config.h"

class DisplayManager {
public:
    DisplayManager();
    void begin();
    void showMessage(const char* msg);
private:
    Adafruit_ILI9341 _tft;
};

extern DisplayManager displayManager;

#endif
