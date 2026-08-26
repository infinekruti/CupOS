#include <Arduino.h>
#include <Wire.h>

#include "config/config.h"
#include "diagnostics/diagnostics.h"
#include "relay/relay.h"
#include "engine/engine.h"
#include "state/state_machine.h"
#include "qr/qr.h"
#include "gsm/network.h"
#include "cup/cup.h"
#include "display/display.h"
#include "audio/audio.h"
#include "storage/storage.h"
#include "shutter/shutter.h"
#include <esp_task_wdt.h>
#include "soc/soc.h"
#include "soc/rtc_cntl_reg.h"

extern HardwareSerial SerialAT;

// Globals
Engine engine;
StateMachine sm;
QRScanner qr(QR_RX, QR_TX, QR_BAUDRATE);
Network net("cupos.in", 443);

// Set to true to test individual components, false for normal operation
bool TEST_MODE = false;

void setup()
{
    // DISABLE BROWNOUT DETECTOR
    // Prevents the ESP32 from rebooting if the 5V rail temporarily dips due to
    // the sudden inrush current of the DC motors or 4G modem.
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0);

    Serial.begin(DEBUG_BAUDRATE);
    
    // Enable Watchdog Timer (60 seconds timeout to cover GSM latency)
    esp_task_wdt_init(60, true);
    esp_task_wdt_add(NULL);
    
    // Basic hardware init
    Wire.begin(I2C_SDA, I2C_SCL);

    // Initialize diagnostics
    diagnostics.begin();
    diagnostics.info(ModuleID::System, (String("CupOS V") + FW_VERSION + " booting...").c_str());

    // Initialize SPI bus first, exactly as your original code did!
    SPI.begin(SPI_SCK, SPI_MISO, SPI_MOSI);

    // Initialize display, cup, audio, storage, shutter
    // TFT must initialize FIRST, otherwise the GFX library can reset the SPI bus!
    displayManager.begin();
    cupDispenser.begin();
    audioPlayer.begin();
    storage.begin();
    shutter.begin();

    // Initialize network and QR
    net.begin();
    qr.begin();

    // Start engine and state machine
    engine.begin();
    sm.begin(&qr, &net);

    diagnostics.info(ModuleID::System, "System Ready");


    if (TEST_MODE) {
        Serial.println("\n\n=== CupOS Hardware Test Menu ===");
        Serial.println("[c] - Dispense Cup");
        Serial.println("[1] - Bev 1 Full (2s)");
        Serial.println("[2] - Bev 2 Full (2s)");
        Serial.println("[3] - Bev 3 Full (2s)");
        Serial.println("[4] - Bev 4 Full (2s)");
        Serial.println("[5] - Bev 1 Half (2s)");
        Serial.println("[6] - Bev 2 Half (2s)");
        Serial.println("[7] - Bev 3 Half (2s)");
        Serial.println("[8] - Bev 4 Half (2s)");
        Serial.println("[o] - Open Shutter");
        Serial.println("[x] - Close Shutter");
        Serial.println("[a] - Play Audio Test");
        Serial.println("[d] - Update Display Test");
        Serial.println("[q] - Simulate Network Verify");
        Serial.println("[g] - AT Passthrough (Test 4G Module directly)");
        Serial.println("[l] - Test Limit Switches (10s)");
        Serial.println("[s] - Test Cup Sensors (10s)");
        Serial.println("[z] - Test SD Card Read/Write");
        Serial.println("[r] - Test QR Scanner (15s)");
        Serial.println("[t] - Raw QR Hex Dump (Debug)");
        Serial.println("================================\n");
    }
}

void loop()
{
    const unsigned long HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes

    // Only send heartbeat if we are completely idle AND haven't communicated with the server in the last 5 mins
    if (!TEST_MODE && sm.current() == CupOSState::Idle && (millis() - net.getLastCommTime() >= HEARTBEAT_INTERVAL)) {
        diagnostics.info(ModuleID::System, "Sending 5-Min Heartbeat...");
        if (net.sendHeartbeat()) {
            diagnostics.info(ModuleID::System, "Heartbeat OK");
        } else {
            diagnostics.warning(ModuleID::System, "Heartbeat Failed");
        }
    }

    // Update core modules
    diagnostics.update();

    
    if (TEST_MODE) {
        if (Serial.available()) {
            char cmd = Serial.read();
            switch (cmd) {
                case 'c': engine.dispenseCup(); break;
                case '1': engine.dispenseProduct(0, 2000, false); break;
                case '2': engine.dispenseProduct(1, 2000, false); break;
                case '3': engine.dispenseProduct(2, 2000, false); break;
                case '4': engine.dispenseProduct(3, 2000, false); break;
                case '5': engine.dispenseProduct(0, 2000, true); break;
                case '6': engine.dispenseProduct(1, 2000, true); break;
                case '7': engine.dispenseProduct(2, 2000, true); break;
                case '8': engine.dispenseProduct(3, 2000, true); break;
                case 'o': engine.openShutter(); break;
                case 'x': engine.closeShutter(); break;
                case 'a': engine.playSound("/CupOS.wav"); break;
                case 'd': displayManager.showMessage("Display Test OK!"); break;
                case 'q': {
                    uint8_t prodId;
                    uint16_t dur;
                    String pName;
                    bool isHalf;
                    String failReason;
                    net.verifyOrder("mock_qr_token_123", prodId, dur, pName, isHalf, failReason);
                    break;
                }
                case 'g': {
                    Serial.println("\n--- Running Automated 4G Module Diagnostics ---");
                    
                    auto runATCommand = [](const char* cmd, int waitMs = 500) {
                        Serial.print("\n> ");
                        Serial.println(cmd);
                        SerialAT.println(cmd);
                        delay(waitMs);
                        while (SerialAT.available()) {
                            Serial.write(SerialAT.read());
                        }
                    };

                    runATCommand("AT");
                    runATCommand("ATV1"); // Enable verbose text responses (OK instead of 0)
                    runATCommand("AT+CFUN=1", 2000); // Turn off Flight Mode!
                    runATCommand("ATI");
                    runATCommand("AT+CPIN?");
                    runATCommand("AT+CSQ");
                    runATCommand("AT+CREG?");
                    runATCommand("AT+CPSI?", 1000);
                    runATCommand("AT+CGATT?");

                    Serial.println("\n--- Entering Manual AT Passthrough Mode ---");
                    Serial.println("Diagnostics complete. You can now type custom AT commands.");
                    Serial.println("Reset board to exit this mode.");

                    while (true) {
                        esp_task_wdt_reset(); // Feed WDT so it doesn't reboot
                        if (Serial.available()) {
                            char c = Serial.read();
                            Serial.write(c); // Local echo so you can see what you type!
                            SerialAT.write(c);
                        }
                        if (SerialAT.available()) {
                            Serial.write(SerialAT.read());
                        }
                    }
                    break;
                }
                case 'l': {
                    Serial.println("\n--- Testing Limit Switches for 10 seconds ---");
                    uint32_t start_time = millis();
                    while (millis() - start_time < 10000) {
                        esp_task_wdt_reset();
                        Serial.print("Open Limit Switch: ");
                        Serial.print(relay.isShutterOpen() ? "TRIGGERED (PRESSED)" : "IDLE");
                        Serial.print(" | Close Limit Switch: ");
                        Serial.println(relay.isShutterClosed() ? "TRIGGERED (PRESSED)" : "IDLE");
                        delay(250);
                    }
                    Serial.println("--- Test Complete ---");
                    break;
                }
                case 's': {
                    Serial.println("\n--- Testing Cup Sensors (E18-D80NK) for 10 seconds ---");
                    uint32_t start_time = millis();
                    while (millis() - start_time < 10000) {
                        esp_task_wdt_reset();
                        bool s1 = digitalRead(CUP_SENSOR_1) == LOW;
                        bool s2 = digitalRead(CUP_SENSOR_2) == LOW;
                        Serial.print("Cup Sensor 1: ");
                        Serial.print(s1 ? "DETECTED (LOW)" : "CLEAR (HIGH)");
                        Serial.print(" | Cup Sensor 2: ");
                        Serial.print(s2 ? "DETECTED (LOW)" : "CLEAR (HIGH)");
                        Serial.print(" => isCupPresent(): ");
                        Serial.println(cupDispenser.isCupPresent() ? "YES" : "NO");
                        delay(250);
                    }
                    Serial.println("--- Test Complete ---");
                    break;
                }
                case 'z': {
                    Serial.println("\n--- Testing SD Card Read/Write ---");
                    const char* testPath = "/test_log.txt";
                    
                    Serial.println("1. Writing initial string to /test_log.txt...");
                    if (storage.writeFile(testPath, "CupOS SD Card Test Log\n")) {
                        Serial.println("   -> Write Success!");
                    } else {
                        Serial.println("   -> Write Failed!");
                    }
                    
                    Serial.println("2. Appending new line to /test_log.txt...");
                    if (storage.appendFile(testPath, "Test Line 2 - Append Success!\n")) {
                        Serial.println("   -> Append Success!");
                    } else {
                        Serial.println("   -> Append Failed!");
                    }
                    
                    Serial.println("3. Reading file contents:");
                    String content = storage.readFile(testPath);
                    Serial.println("================ FILE CONTENT ================");
                    Serial.print(content);
                    Serial.println("==============================================");
                    
                    Serial.println("--- Test Complete ---");
                    break;
                }
                case 'r': {
                    Serial.println("\n--- Testing QR Scanner for 15 seconds ---");
                    Serial.println("Please scan a QR code now...");
                    displayManager.showMessage("Please scan a QR code now...");
                    
                    uint32_t start_time = millis();
                    bool scanned = false;
                    
                    while (millis() - start_time < 15000) {
                        esp_task_wdt_reset();
                        if (qr.available()) {
                            String data = qr.read();
                            Serial.print("\n>>> QR CODE SCANNED: [");
                            Serial.print(data);
                            Serial.println("] <<<");
                            
                            // Show on TFT Screen
                            String displayTxt = "Scanned:\n\n" + data;
                            displayManager.showMessage(displayTxt.c_str());
                            
                            scanned = true;
                            // Reset timer so they can scan multiple in a row during the test
                            start_time = millis();
                        }
                        delay(10);
                    }
                    if (!scanned) {
                        Serial.println("\nNo QR code detected.");
                        Serial.println("Troubleshooting: Most QR scanners default to 9600 baud.");
                        Serial.println("If you scanned something but got nothing, check your baud rate setting!");
                        displayManager.showMessage("Test Timeout.\nNo QR Detected.");
                    } else {
                        delay(2000); // Give them time to read the last scan on the screen
                        displayManager.showMessage("Test Complete");
                    }
                    Serial.println("--- Test Complete ---");
                    break;
                }
                case 't': {
                    Serial.println("\n--- Raw QR Hex Dump for 15 seconds ---");
                    Serial.println("Scan a code. This will print exactly what comes over the wire byte-by-byte.");
                    uint32_t start_time = millis();
                    int byteCount = 0;
                    
                    while (millis() - start_time < 15000) {
                        esp_task_wdt_reset();
                        while (qr.available()) {
                            int b = qr.readRaw();
                            if (b != -1) {
                                Serial.print("0x");
                                if (b < 16) Serial.print("0");
                                Serial.print(b, HEX);
                                Serial.print(" (");
                                if (b >= 32 && b <= 126) Serial.print((char)b);
                                else Serial.print(".");
                                Serial.print(") ");
                                byteCount++;
                                start_time = millis(); // reset timeout
                            }
                        }
                        delay(5);
                    }
                    if (byteCount == 0) {
                        Serial.println("\nNO BYTES RECEIVED. The ESP32 is completely deaf on this pin.");
                        Serial.println("1. Verify the QR scanner has power (does the light turn on?).");
                        Serial.println("2. Swap the RX and TX wires. You probably have TX connected to TX.");
                    } else {
                        Serial.println("\n--- Raw Dump Complete ---");
                    }
                    break;
                }
            }
        }
    } else {
        // Run standard state machine
        sm.update();
    }
    
    // Update audio loop
    audioPlayer.update();
    
    // Feed the watchdog timer so it doesn't reset the ESP32
    esp_task_wdt_reset();
    
    yield();
}