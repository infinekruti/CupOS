#include "network.h"
#include "../config/config.h"
#include "../diagnostics/diagnostics.h"
#include <ArduinoJson.h>
#include <ArduinoHttpClient.h>
#include <esp_task_wdt.h>

#define TINY_GSM_MODEM_A7672X
#include <TinyGsmClient.h>

// GSM Serial port (HardwareSerial 1)
HardwareSerial SerialAT(1);

TinyGsm modem(SerialAT);
TinyGsmClientSecure client(modem);


Network::Network(const char* host, uint16_t port)
    : _host(host), _port(port) {}

void Network::begin() {
    diagnostics.info(ModuleID::System, "Initializing GSM...");
    
    // Begin AT serial
    SerialAT.begin(115200, SERIAL_8N1, GSM_RX, GSM_TX);
    
    delay(3000);
    // Force flight mode off automatically during boot
    SerialAT.println("AT+CFUN=1");
    delay(2000);
    
    if (!modem.init()) {
        diagnostics.error(ModuleID::System, "Failed to initialize GSM modem");
        return;
    }
    
    String modemInfo = modem.getModemInfo();
    diagnostics.info(ModuleID::System, (String("Modem Info: ") + modemInfo).c_str());
    
    diagnostics.info(ModuleID::System, "Waiting for network...");
    if (!modem.waitForNetwork(10000L)) {
        diagnostics.error(ModuleID::System, "Network failed to connect");
        return;
    }
    
    diagnostics.info(ModuleID::System, "Connecting to APN...");
    // Replace with real APN
    if (!modem.gprsConnect("internet", "", "")) {
        diagnostics.error(ModuleID::System, "APN connection failed");
        return;
    }
    
    diagnostics.info(ModuleID::System, "GSM Network Connected!");
}

bool Network::verifyOrder(const String& qrPayload, uint8_t& productId, uint16_t& durationMs, String& productName, bool& isHalf) {
    Serial.println("  [verifyOrder] Bypassing HTTP request (Domain not live yet)...");
    
    // MOCK SERVER RESPONSE
    productId = 0;           // Dispense Beverage 1
    durationMs = 2000;       // 2 seconds
    productName = "Test Drink";
    isHalf = false;
    
    diagnostics.info(ModuleID::System, "Order OK - (MOCKED BYPASS)");
    return true;
}

bool Network::isConnected() {
    return modem.isNetworkConnected();
}

void Network::reconnect() {
    begin();
}
