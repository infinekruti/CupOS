#include "cup.h"
#include "../config/config.h"
#include "../diagnostics/diagnostics.h"
#include "../relay/relay.h"

CupDispenser cupDispenser;

bool CupDispenser::isCupPresent() {
    // Assuming active-low logic for the sensors (e.g. IR break beam). 
    // Returns true if sensor 1 detects a cup.
    return (digitalRead(CUP_SENSOR_1) == LOW);
}

void CupDispenser::begin() {
    pinMode(CUP_SENSOR_1, INPUT_PULLUP);
    pinMode(CUP_SENSOR_2, INPUT_PULLUP);
    
    // Standard MG996R servo min/max pulse widths
    _servo.attach(CUP_SERVO_PIN, 500, 2500);
    _servo.write(0); // Idle position
}

bool CupDispenser::dispense() {
    for (int attempt = 1; attempt <= 3; attempt++) {
        diagnostics.info(ModuleID::System, (String("Activating Cup Servo (Attempt ") + String(attempt) + ")").c_str());
        _servo.write(100); // Rotate to drop cup
        delay(1000);       // Allow time for full physical rotation
        _servo.write(0);   // Return to idle
        delay(1000);       // Wait for cup to fall and settle
        
        if (isCupPresent()) {
            return true; // Success!
        }
        
        if (attempt < 3) {
            diagnostics.warning(ModuleID::System, "Cup not detected, retrying...");
            delay(500); // Brief pause before trying again
        }
    }
    
    // If it reaches here, all 3 attempts failed
    diagnostics.error(ModuleID::System, "Error: Cup failed to drop after 3 attempts!");
    return false;
}
