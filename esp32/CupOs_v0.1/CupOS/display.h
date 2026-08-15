#pragma once
#include <TFT_eSPI.h>

class Display {
public:
    void begin();
    void showMessage(const char* msg);
private:
    TFT_eSPI tft;
};
