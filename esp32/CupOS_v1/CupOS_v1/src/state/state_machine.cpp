#include "state_machine.h"
#include "../diagnostics/diagnostics.h"
#include "../display/display.h"
#include <esp_task_wdt.h>
#include "../audio/audio.h"

void StateMachine::begin(QRScanner* qr, Network* net) {
    _qr = qr;
    _net = net;
    extern Engine engine;
    _engine = &engine;

    _state = CupOSState::Boot;
    _stateStartMs = millis();
    diagnostics.info(ModuleID::System, "[SM] Boot");
}

bool StateMachine::processQR() {
    if (_qr && _qr->available()) {
        Serial.println(">>> QR SCAN INITIATED - BYTES DETECTED <<<");
        String payload = _qr->read();
        Serial.println(">>> QR PAYLOAD READ: " + payload + " <<<");
        diagnostics.info(ModuleID::System, (String("[QR] Scanned: ") + payload).c_str());
        uint8_t prodId;
        uint16_t dur;
        String pName;
        bool isHalf;
        if (_net && _net->verifyOrder(payload, prodId, dur, pName, isHalf)) {
            _productId = prodId;
            _dispenseMs = dur;
            _productName = pName;
            _isHalf = isHalf;
            return true;
        } else {
            Serial.println(">>> ORDER VERIFICATION FAILED <<<");
            displayManager.showMessage("Order Rejected");
        }
    }
    return false;
}

void StateMachine::update() {
    if (!_engine) return;

    switch (_state) {
        case CupOSState::Boot:
            if (elapsed(500)) {
                _state = CupOSState::SelfTest;
                _stateStartMs = millis();
                diagnostics.info(ModuleID::System, "[SM] SelfTest");
                _engine->begin(); 
            }
            break;

        case CupOSState::SelfTest:
            diagnostics.info(ModuleID::System, "[SM] Homing Shutter...");
            displayManager.showMessage("Calibrating...");
            
            // Force shutter to close if it was left open during a power outage
            if (!_engine->closeShutter()) {
                _state = CupOSState::Error;
                _stateStartMs = millis();
                diagnostics.error(ModuleID::System, "[SM] Shutter Homing Failed!");
                displayManager.showMessage("Out of Order (Jam)");
                _engine->playSound("error_jam.wav"); // Play sound alert
            } else {
                _state = CupOSState::Idle;
                _stateStartMs = millis();
                diagnostics.info(ModuleID::System, "[SM] Idle");
                displayManager.showMessage("Scan QR to Order");
            }
            break;

        case CupOSState::Idle:
            // Check network health every 15 seconds
            if (elapsed(15000)) {
                _stateStartMs = millis();
                if (_net && !_net->isConnected()) {
                    diagnostics.warning(ModuleID::System, "Network dropped! Reconnecting...");
                    displayManager.showMessage("Reconnecting...");
                    _net->reconnect();
                    if (_net->isConnected()) {
                        displayManager.showMessage("Scan QR to Order");
                    } else {
                        displayManager.showMessage("Network Error");
                    }
                }
            }
            
            if (processQR()) {
                if (_engine->isCupPresent()) {
                    _state = CupOSState::Collect;
                    _stateStartMs = millis();
                    diagnostics.info(ModuleID::System, "[SM] Clearing abandoned cup");
                    displayManager.showMessage("Please clear old cup!");
                } else {
                    _state = CupOSState::CupDispense;
                    _stateStartMs = millis();
                    diagnostics.info(ModuleID::System, "[SM] CupDispense (order received)");
                    displayManager.showMessage("Order Received!");
                }
            }
            break;

        case CupOSState::CupDispense:
            if (!_engine->dispenseCup()) {
                _state = CupOSState::Error;
                _stateStartMs = millis();
                displayManager.showMessage("Out of Order (Cup)");
                _engine->playSound("error_jam.wav"); // Play sound alert
            } else {
                _state = CupOSState::BeveragePrep;
                _stateStartMs = millis();
                diagnostics.info(ModuleID::System, "[SM] BeveragePrep");
                displayManager.showMessage((String("Preparing ") + _productName + "...\n\nDoor will open\nwhen ready!").c_str());
            }
            break;

        case CupOSState::BeveragePrep:
            // Dispense product (this call blocks safely using WDT feed)
            _engine->dispenseProduct(_productId, _dispenseMs, _isHalf);
            
            _engine->playSound("/CupOS.wav"); // Starts song in background!
            
            // Wait 5 seconds into the song before opening the door
            {
                uint32_t waitStart = millis();
                while (millis() - waitStart < 5000) {
                    esp_task_wdt_reset();
                    audioPlayer.update(); // Keep streaming music during the delay!
                    delay(10);
                }
            }
            
            _state = CupOSState::ShutterOpen;
            _stateStartMs = millis();
            diagnostics.info(ModuleID::System, "[SM] ShutterOpen");
            // No screen update here to prevent SPI collision with audio
            break;

        case CupOSState::ShutterOpen:
            if (!_engine->openShutter()) {
                _state = CupOSState::Error;
                _stateStartMs = millis();
                displayManager.showMessage("Out of Order (Door)");
                _engine->playSound("error_jam.wav"); // Play sound alert
            } else {
                _state = CupOSState::Ready;
                _stateStartMs = millis();
                diagnostics.info(ModuleID::System, "[SM] Ready (Drink available)");
                // No screen update here to prevent SPI collision with audio
            }
            break;

        case CupOSState::Ready:
            // SAFETY LOGIC: Wait until the user physically removes the cup, OR timeout after 30 seconds
            if (!_engine->isCupPresent()) {
                _state = CupOSState::ShutterClose;
                _stateStartMs = millis();
                diagnostics.info(ModuleID::System, "[SM] ShutterClose");
                displayManager.showMessage("Closing Door...");
            } else if (elapsed(30000)) {
                diagnostics.warning(ModuleID::System, "[SM] Drink abandoned!");
                _engine->playSound("error_jam.wav"); // Play alert for forgotten drink
                _state = CupOSState::ShutterClose;
                _stateStartMs = millis();
                displayManager.showMessage("Closing Door...");
            }
            break;

        case CupOSState::ShutterClose:
            if (!_engine->closeShutter()) {
                _state = CupOSState::Error;
                _stateStartMs = millis();
                displayManager.showMessage("Out of Order (Door)");
                _engine->playSound("error_jam.wav"); // Play sound alert
            } else {
                _state = CupOSState::Idle;
                _stateStartMs = millis();
                diagnostics.info(ModuleID::System, "[SM] Idle (Ready for next)");
                displayManager.showMessage("Scan QR to Order");
            }
            break;

        case CupOSState::Error:
            // Stay in error state indefinitely, wait for admin reboot
            break;

        case CupOSState::Collect:
            // State used to clear an abandoned cup before a new order
            displayManager.showMessage("Opening Door...");
            if (!_engine->openShutter()) {
                _state = CupOSState::Error;
                _stateStartMs = millis();
                displayManager.showMessage("Out of Order (Door)");
                _engine->playSound("error_jam.wav");
            } else {
                _state = CupOSState::AwaitOrder;
                _stateStartMs = millis();
                displayManager.showMessage("Please remove old cup!");
                _engine->playSound("error_jam.wav"); // Alert user to remove cup
            }
            break;

        case CupOSState::AwaitOrder:
            if (!_engine->isCupPresent()) {
                // Cup was successfully removed!
                displayManager.showMessage("Thank you! Starting order...");
                if (!_engine->closeShutter()) {
                    _state = CupOSState::Error;
                    _stateStartMs = millis();
                    displayManager.showMessage("Out of Order (Door)");
                    _engine->playSound("error_jam.wav");
                } else {
                    // Old cup is gone and door is closed, proceed with new order!
                    _state = CupOSState::CupDispense;
                    _stateStartMs = millis();
                    displayManager.showMessage("Order Received!");
                }
            } else if (elapsed(45000)) {
                // User scanned QR but walked away without removing the old cup
                diagnostics.warning(ModuleID::System, "[SM] User failed to clear cup");
                _engine->closeShutter();
                _state = CupOSState::Idle;
                _stateStartMs = millis();
                displayManager.showMessage("Scan QR to Order");
            }
            break;
    }
}
