#ifndef DISPLAY_H
#define DISPLAY_H

#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <Fonts/FreeSans9pt7b.h>
#include <Fonts/FreeSansBold12pt7b.h>
#include "../config/config.h"

class DisplayManager {
public:
    DisplayManager();
    void begin();
    void showMessage(const char* msg);
    void updateStatus(const char* msg);
    void showIdleScreen(const char* url);
private:
    Adafruit_ILI9341 _tft;
};

extern DisplayManager displayManager;

#endif
