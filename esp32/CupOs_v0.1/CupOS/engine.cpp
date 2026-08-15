// File: engine.cpp – implementation of high‑level hardware actions
#include "engine.h"
#include "config.h"
#include "pcf8574.h"

void Engine::begin() {
    // Initialise any hardware that the Engine will control.
    // For now we just ensure the PCF8574 expanders are ready – they are
    // already init‑ed in main.cpp, but calling again is safe.
    PCF8574_init(PCF1_ADDRESS);
    PCF8574_init(PCF2_ADDRESS);
}

void Engine::dispenseCup() {
    // Placeholder: this would drive the MG996R servo via a dedicated pin.
    // For now we just toggle a dummy pin (e.g., PCF1 spare) to illustrate.
    PCF1_setBeverageRelay(SPARE, true);
    delay(200); // simulate servo travel
    PCF1_setBeverageRelay(SPARE, false);
}

void Engine::openShutter() {
    // Activate shutter motor IN1 and deactivate IN2 (typical H‑bridge control)
    PCF2_setShutterIn1(true);
    PCF2_setShutterIn2(false);
    // In a real system you would monitor limit switches here.
}

void Engine::closeShutter() {
    PCF2_setShutterIn1(false);
    PCF2_setShutterIn2(true);
}

void Engine::dispenseIngredient(uint8_t id, uint16_t ms) {
    // Map id to beverage relay – assume id matches BeverageRelay enum values.
    // Turn the relay on, wait, then turn off.
    PCF1_setBeverageRelay(static_cast<BeverageRelay>(id), true);
    delay(ms);
    PCF1_setBeverageRelay(static_cast<BeverageRelay>(id), false);
}

void Engine::dispenseProduct(uint8_t productId, uint16_t ms) {
    PCF1_setBeverageRelay(static_cast<BeverageRelay>(productId), true);
    delay(ms);
    PCF1_setBeverageRelay(static_cast<BeverageRelay>(productId), false);
}

void Engine::playSound(const char* name) {
    // Stub – in real code you would queue a WAV file on the I2S audio subsystem.
    Serial.printf("[Audio] Play sound: %s\n", name);
}
