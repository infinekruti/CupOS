#include "shutter.h"
#include "../config/config.h"
#include "../relay/relay.h"
#include "../diagnostics/diagnostics.h"
#include "../audio/audio.h"

ShutterManager shutter;

void ShutterManager::begin() {
    // Relay begin already configures the PCF_SHUTTER pins
}

bool ShutterManager::open() {
    diagnostics.info(ModuleID::System, "Shutter motor opening...");
    
    // Safety 1: Broken wire detection (NC switches float HIGH when disconnected)
    if (isOpen() && isClosed()) {
        diagnostics.error(ModuleID::System, "CRITICAL: Shutter limit switch wiring fault detected!");
        return false;
    }
    
    // Safety 2: Already in desired state
    if (isOpen()) {
        diagnostics.info(ModuleID::System, "Shutter already open");
        return true;
    }

    // Attempt 1
    relay.shutterForward();
    uint32_t start = millis();
    bool success = false;
    while (millis() - start < 7000) {
        if (isOpen()) {
            success = true;
            break;
        }
        audioPlayer.update(); // Keep music alive while motor turns
        delay(10);
    }
    stop();
    
    if (success) {
        diagnostics.info(ModuleID::System, "Shutter successfully opened");
        return true;
    }
    
    // Safety 3: Anti-Jam Retry
    diagnostics.warning(ModuleID::System, "Shutter open jammed! Attempting recovery...");
    relay.shutterReverse();
    start = millis();
    success = false;
    // Reverse slightly (2 seconds) to clear the jam, or until close switch hit
    while (millis() - start < 2000) {
        if (isClosed()) break;
        audioPlayer.update(); // Keep music alive
        delay(10);
    }
    stop();
    delay(500); // Pause before retry
    
    // Retry Attempt 2
    relay.shutterForward();
    start = millis();
    success = false;
    while (millis() - start < 7000) {
        if (isOpen()) {
            success = true;
            break;
        }
        audioPlayer.update(); // Keep music alive
        delay(10);
    }
    stop();
    
    if (success) {
        diagnostics.info(ModuleID::System, "Shutter opened successfully on retry");
        return true;
    } else {
        diagnostics.error(ModuleID::System, "Shutter open failed after retry! Machine Locked.");
        return false;
    }
}

bool ShutterManager::close() {
    diagnostics.info(ModuleID::System, "Shutter motor closing...");
    
    // Safety 1: Broken wire detection
    if (isOpen() && isClosed()) {
        diagnostics.error(ModuleID::System, "CRITICAL: Shutter limit switch wiring fault detected!");
        return false;
    }
    
    // Safety 2: Already in desired state
    if (isClosed()) {
        diagnostics.info(ModuleID::System, "Shutter already closed");
        return true;
    }

    // Attempt 1
    relay.shutterReverse();
    uint32_t start = millis();
    bool success = false;
    while (millis() - start < 7000) {
        if (isClosed()) {
            success = true;
            break;
        }
        audioPlayer.update(); // Keep music alive while motor turns
        delay(10);
    }
    stop();
    
    if (success) {
        diagnostics.info(ModuleID::System, "Shutter successfully closed");
        return true;
    }
    
    // Safety 3: Anti-Jam Retry
    diagnostics.warning(ModuleID::System, "Shutter close jammed! Attempting recovery...");
    relay.shutterForward();
    start = millis();
    success = false;
    // Reverse slightly (2 seconds) to clear the jam, or until open switch hit
    while (millis() - start < 2000) {
        if (isOpen()) break;
        delay(10);
    }
    stop();
    delay(500); // Pause before retry
    
    // Retry Attempt 2
    relay.shutterReverse();
    start = millis();
    success = false;
    while (millis() - start < 7000) {
        if (isClosed()) {
            success = true;
            break;
        }
        audioPlayer.update(); // Keep music alive
        delay(10);
    }
    stop();
    
    if (success) {
        diagnostics.info(ModuleID::System, "Shutter closed successfully on retry");
        return true;
    } else {
        diagnostics.error(ModuleID::System, "Shutter close failed after retry! Machine Locked.");
        return false;
    }
}

void ShutterManager::stop() {
    relay.shutterStop();
}

bool ShutterManager::isOpen() {
    return relay.isShutterOpen();
}

bool ShutterManager::isClosed() {
    return relay.isShutterClosed();
}
