#include "engine.h"
#include "../config/config.h"
#include "../relay/relay.h"
#include "../diagnostics/diagnostics.h"
#include "../shutter/shutter.h"
#include "../cup/cup.h"
#include "../audio/audio.h"
#include <esp_task_wdt.h>

void Engine::begin() {
    relay.begin();
}

bool Engine::dispenseCup() {
    diagnostics.info(ModuleID::System, "Engine dispensing cup");
    return cupDispenser.dispense();
}

bool Engine::isCupPresent() {
    return cupDispenser.isCupPresent();
}

bool Engine::openShutter() {
    return shutter.open();
}

bool Engine::closeShutter() {
    return shutter.close();
}

void Engine::dispenseProduct(uint8_t productId, uint16_t ms, bool isHalf) {
    diagnostics.info(ModuleID::System, (String("Dispensing product ") + String(productId) + " (Half: " + String(isHalf) + ")").c_str());

    if (isHalf) {
        // Trigger the half quantity button switch relay first
        relay.halfCup(true);
        delay(300); // Short button press simulation
        relay.halfCup(false);
        delay(200); // Brief pause before triggering product relay
    }

    // Trigger the actual product relay
    switch (productId) {
        case 0: relay.beverage1(true); break;
        case 1: relay.beverage2(true); break;
        case 2: relay.beverage3(true); break;
        case 3: relay.beverage4(true); break;
    }
    
    // WDT-Safe Delay Loop
    uint32_t startMs = millis();
    while (millis() - startMs < ms) {
        esp_task_wdt_reset();
        delay(10);
    }
    
    switch (productId) {
        case 0: relay.beverage1(false); break;
        case 1: relay.beverage2(false); break;
        case 2: relay.beverage3(false); break;
        case 3: relay.beverage4(false); break;
    }
}

void Engine::flushMachine() {
    diagnostics.info(ModuleID::System, "Executing Hygiene Flush combination: 4x Relay 5, then 1x Relay 1");

    // 1. Pulse Relay 5 (RELAY_HALF) 4 times
    for (int i = 0; i < 4; i++) {
        relay.halfCup(true);
        delay(250);
        relay.halfCup(false);
        delay(200);
        esp_task_wdt_reset();
    }

    delay(300);
    esp_task_wdt_reset();

    // 2. Pulse Relay 1 (RELAY_BEV1) once
    relay.beverage1(true);
    delay(400);
    relay.beverage1(false);

    diagnostics.info(ModuleID::System, "Flush combination triggered. Machine will start rinse in ~4s.");
}

void Engine::playSound(const char* name) {
    audioPlayer.play(name);
}
