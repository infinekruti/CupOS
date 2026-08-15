#pragma once
#include <Arduino.h>
#include "pcf8574.h"

// Engine – high‑level actions that control the hardware.
// This class is deliberately lightweight; it just forwards calls to
// the PCF8574 helper functions (and would later call display/audio/etc.).

class Engine {
public:
    Engine() = default;
    void begin();                     // Called once during setup

    // Core actions (stubbed for now)
    void dispenseCup();                // Activate cup dispenser servo via PCF (placeholder)
    void openShutter();                // Open the beverage delivery shutter
    void closeShutter();               // Close the shutter
    void dispenseIngredient(uint8_t id, uint16_t ms); // id maps to a beverage relay
    void dispenseProduct(uint8_t productId, uint16_t ms); // maps to product relay

    // Example: play a sound (placeholder)
    void playSound(const char* name);

private:
    // Internal state could be expanded later (e.g., error flags)
};
