#pragma once
#include <Arduino.h>
#include "engine.h"
#include "qrscanner.h"
#include "network.h"

enum class CupOSState {
    Boot,
    SelfTest,
    Idle,
    AwaitOrder,
    CupDispense,
    ShutterOpen,
    BeveragePrep,
    ShutterClose,
    Ready,
    Collect,
    Error
};

class StateMachine {
public:
    StateMachine() = default;
    void begin(QRScanner* qr, Network* net);
    void update();
    CupOSState current() const { return _state; }
private:
    CupOSState _state = CupOSState::Boot;
    unsigned long _stateStartMs = 0;
    bool elapsed(uint32_t ms) const { return (millis() - _stateStartMs) >= ms; }
    Engine* _engine = nullptr;
    QRScanner* _qr = nullptr;
    Network* _net = nullptr;
    uint8_t _productId = 0;
    uint16_t _dispenseMs = 0;
    bool processQR();
};
