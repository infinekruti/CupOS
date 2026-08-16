#include "display.h"
#include "../diagnostics/diagnostics.h"
#include <qrcode.h>

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
    // 1. Draw Background (Dark Theme)
    _tft.fillScreen(_tft.color565(10, 10, 10)); // Deep dark grey
    
    uint16_t brandColor = _tft.color565(200, 146, 42); // CupOS Gold (#C8922A)
    
    // 2. Draw Elegant Separator Line
    _tft.drawFastHLine(0, 48, 240, brandColor);
    _tft.drawFastHLine(0, 49, 240, brandColor);
    
    // 3. Draw Header Text "cupOS" (Two-Toned Web Styling)
    _tft.setFont(&FreeSansBold12pt7b);
    
    int16_t x1, y1;
    uint16_t total_w, h;
    _tft.getTextBounds("cupOS", 0, 0, &x1, &y1, &total_w, &h);
    
    int start_x = (240 - total_w) / 2;
    _tft.setCursor(start_x, 34); // Centered vertically in the 48px header
    
    // Print "cup" in White
    _tft.setTextColor(ILI9341_WHITE);
    _tft.print("cup");
    
    // Print "OS" in Coffee Brown
    _tft.setTextColor(brandColor);
    _tft.print("OS");
    
    // 4. Draw Main Message Text
    _tft.setFont(&FreeSans9pt7b);
    _tft.setTextColor(ILI9341_WHITE);
    
    String s = msg;
    int y = 95; // Start drawing below the separator
    int start = 0;
    
    // Parse newlines and center each line automatically
    while(start < s.length()) {
        int newline = s.indexOf('\n', start);
        if (newline == -1) newline = s.length();
        String line = s.substring(start, newline);
        
        if (line.length() > 0) {
            uint16_t line_w;
            _tft.getTextBounds(line.c_str(), 0, 0, &x1, &y1, &line_w, &h);
            _tft.setCursor((240 - line_w) / 2, y);
            _tft.print(line);
        }
        y += 28; // Line spacing
        start = newline + 1;
    }
}

void DisplayManager::showIdleScreen(const char* url) {
    // Re-use the background and header logic by sending an empty message
    showMessage("");
    
    // Create the QR Code object
    QRCode qrcode;
    uint8_t qrcodeData[qrcode_getBufferSize(3)];
    
    // Initialize QR code with URL (Version 3 supports up to 55 alphanumeric characters at ECC Low)
    qrcode_initText(&qrcode, qrcodeData, 3, 0, url);
    
    // Calculate sizing to perfectly center on 240x320 portrait screen
    // Version 3 QR code is 29x29 modules. 
    int scale = 5; // 29 * 5 = 145px width/height
    int qr_size = qrcode.size * scale;
    int offset_x = (240 - qr_size) / 2;
    int offset_y = 85; // Placed nicely below the header
    int padding = 10;
    
    // Draw a white bounding box to give the QR code a quiet zone (required for scanners)
    _tft.fillRect(offset_x - padding, offset_y - padding, qr_size + (padding*2), qr_size + (padding*2), ILI9341_WHITE);
    
    // Iterate through the QR code matrix and draw the black squares
    for (uint8_t y = 0; y < qrcode.size; y++) {
        for (uint8_t x = 0; x < qrcode.size; x++) {
            if (qrcode_getModule(&qrcode, x, y)) {
                _tft.fillRect(offset_x + (x * scale), offset_y + (y * scale), scale, scale, ILI9341_BLACK);
            }
        }
    }
    
    // Draw Call to Action text
    _tft.setFont(&FreeSans9pt7b);
    _tft.setTextColor(ILI9341_WHITE);
    
    int16_t x1, y1;
    uint16_t w, h;
    _tft.getTextBounds("Scan to Order!", 0, 0, &x1, &y1, &w, &h);
    _tft.setCursor((240 - w) / 2, offset_y + qr_size + padding + 35);
    _tft.print("Scan to Order!");
}

void DisplayManager::updateStatus(const char* msg) {
    // Only clear the bottom area of the screen (below the header and separator)
    _tft.fillRect(0, 50, 240, 270, _tft.color565(10, 10, 10));
    
    _tft.setFont(&FreeSans9pt7b);
    _tft.setTextColor(ILI9341_WHITE);
    
    String s = msg;
    int y = 140; // Center it vertically on the screen
    int start = 0;
    
    // Parse newlines and center each line automatically
    while(start < s.length()) {
        int newline = s.indexOf('\n', start);
        if (newline == -1) newline = s.length();
        String line = s.substring(start, newline);
        
        if (line.length() > 0) {
            int16_t x1, y1;
            uint16_t w, h;
            _tft.getTextBounds(line.c_str(), 0, 0, &x1, &y1, &w, &h);
            _tft.setCursor((240 - w) / 2, y);
            _tft.print(line);
        }
        y += 28; // Line spacing
        start = newline + 1;
    }
}
