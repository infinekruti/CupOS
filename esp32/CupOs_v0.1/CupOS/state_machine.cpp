#include "state_machine.h"

void StateMachine::begin(QRScanner* qr, Network* net) {
    _qr = qr;
    _net = net;
    // Grab the globally defined Engine instance (declared in main.cpp)
    extern Engine engine;
    _engine = &engine;

    _state = CupOSState::Boot;
    _stateStartMs = millis();
    Serial.println("[SM] Boot");
}

bool StateMachine::processQR() {
    if (_qr && _qr->available()) {
        String payload = _qr->read();
        Serial.printf("[QR] Scanned: %s\n", payload.c_str());
        uint8_t prodId;
        uint16_t dur;
        if (_net && _net->verifyOrder(payload, prodId, dur)) {
            _productId = prodId;
            _dispenseMs = dur;
            return true;
        }
    }
    return false;
}

void StateMachine::update() {
    if (!_engine) return; // safety guard

    switch (_state) {
        case CupOSState::Boot:
            if (elapsed(500)) {
                _state = CupOSState::SelfTest;
                _stateStartMs = millis();
                Serial.println("[SM] SelfTest");
                _engine->begin(); // initialise hardware (already done in main, safe)
            }
            break;

        case CupOSState::SelfTest:
            if (elapsed(500)) {
                _state = CupOSState::Idle;
                _stateStartMs = millis();
                Serial.println("[SM] Idle");
            }
            break;

        case CupOSState::Idle:
            // Wait for QR scan
            if (processQR()) {
                _state = CupOSState::CupDispense;
                _stateStartMs = millis();
                Serial.println("[SM] CupDispense (order received)");
                
                // Dispense cup first
                _engine->dispenseCup();
                
                // Click the product specific relay (this currently blocks due to delay)
                _engine->dispenseProduct(_productId, _dispenseMs);
            }
            break;

        case CupOSState::CupDispense:
            // Wait a few seconds after dispensing cup and product
            if (elapsed(2000)) {
                _state = CupOSState::ShutterOpen;
                _stateStartMs = millis();
                Serial.println("[SM] ShutterOpen");
                _engine->openShutter();
            }
            break;

        case CupOSState::ShutterOpen:
            if (elapsed(800)) { // allow time for shutter to physically open
                _state = CupOSState::Ready;
                _stateStartMs = millis();
                Serial.println("[SM] Ready (Drink available)");
                _engine->playSound("drink_ready.wav");
            }
            break;

        case CupOSState::Ready:
            // When user takes product (simulated by a timeout for now)
            if (elapsed(5000)) {
                _state = CupOSState::ShutterClose;
                _stateStartMs = millis();
                Serial.println("[SM] ShutterClose");
                _engine->closeShutter();
            }
            break;

        case CupOSState::ShutterClose:
            if (elapsed(800)) { // allow time for shutter to physically close
                _state = CupOSState::Idle;
                _stateStartMs = millis();
                Serial.println("[SM] Idle (Ready for next)");
            }
            break;

        case CupOSState::BeveragePrep:
        case CupOSState::Collect:
        case CupOSState::AwaitOrder:
        case CupOSState::Error:
            // Unused or placeholders for this flow
            break;
    }
}
