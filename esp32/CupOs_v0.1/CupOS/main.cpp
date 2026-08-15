#include <Arduino.h>
#include "config.h"
#include "pcf8574.h"
#include "engine.h"
#include "state_machine.h"
#include "display.h"
#include "qrscanner.h"
#include "network.h"

// Forward declarations of module init functions (stubs for now)
void initAudio();
void initGSM();

// Globals
Engine engine;
StateMachine sm;
Display display;
QRScanner qr(QR_RX, QR_TX, QR_BAUD);
Network net("api.cupos.com", 80);

void setup() {
    Serial.begin(115200);
    // Basic hardware init
    Wire.begin(SDA_PIN, SCL_PIN);

    // Initialize display
    display.begin();
    display.showMessage("[Init] Display ready");

    // Initialize network and QR
    net.begin();
    qr.begin();

    // Initialize modules (placeholders)
    initAudio();
    initGSM();

    // Initialize PCF8574 expanders
    PCF8574_init(PCF1_ADDRESS);
    PCF8574_init(PCF2_ADDRESS);

    // Start engine and state machine
    engine.begin();
    sm.begin(&qr, &net);

    Serial.println("CupOS V" FW_VERSION " booted");
}

void loop() {
    // Run state machine – it will invoke engine actions as needed
    sm.update();
    delay(10);
}

// ---- Stub implementations -------------------------------------------------
void initAudio() {
    Serial.println("[Init] Audio stub");
}

void initGSM() {
    Serial.println("[Init] GSM stub");
}
