#include <TFT_eSPI.h>
#include "display.h"

void Display::begin() {
    tft.begin();
    tft.setRotation(1);
    tft.fillScreen(TFT_BLACK);
}

void Display::showMessage(const char* msg) {
    tft.setTextColor(TFT_WHITE, TFT_BLACK);
    tft.setTextSize(2);
    tft.setCursor(10, 10);
    tft.print(msg);
}
