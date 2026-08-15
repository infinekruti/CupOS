#include "display.h"
#include "../diagnostics/diagnostics.h"

DisplayManager displayManager;

DisplayManager::DisplayManager() : _tft(TFT_CS, TFT_DC, TFT_RST) {}

void DisplayManager::begin() {
    _tft.begin();
    _tft.setRotation(2); // portait
    _tft.fillScreen(ILI9341_BLACK);
    _tft.setTextColor(ILI9341_WHITE, ILI9341_BLACK);
    _tft.setTextSize(2);
    
    showMessage("Booting CupOS...");
    diagnostics.info(ModuleID::System, "Display Initialized");
}

void DisplayManager::showMessage(const char* msg) {
    _tft.fillScreen(ILI9341_BLACK);
    _tft.setCursor(10, 10);
    _tft.println(msg);
}
