#include "network.h"
#include "../config/config.h"
#include "../diagnostics/diagnostics.h"
#include "../display/display.h"
#include <ArduinoJson.h>
#include <esp_task_wdt.h>

#define TINY_GSM_DEBUG Serial
#define TINY_GSM_MODEM_A7672X
#include <TinyGsmClient.h>

// GSM Serial port (HardwareSerial 1)
HardwareSerial SerialAT(1);

TinyGsm modem(SerialAT);


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

bool Network::verifyOrder(const String& qrPayload, uint8_t& productId, uint16_t& durationMs, String& productName, bool& isHalf, String& failReason) {
    failReason = "Unknown Error";
    Serial.println(">>> [verifyOrder] Started! <<<");
    diagnostics.info(ModuleID::System, "Verifying Token via 4G...");

    if (!isConnected()) {
        Serial.println(">>> [verifyOrder] GSM Not Connected. Reconnecting... <<<");
        diagnostics.warning(ModuleID::System, "Reconnecting GSM...");
        reconnect();
    }

    // Force verbose text responses (OK instead of 0) so the parser doesn't fail
    modem.sendAT(GF("V1"));
    modem.waitResponse();

    Serial.println(">>> [verifyOrder] Opening Network Socket Multiplexer... <<<");
    modem.sendAT(GF("+NETOPEN"));
    modem.waitResponse(10000L); // Wait up to 10s for the network to open

    // Build JSON request payload
    JsonDocument doc;
    doc["machineId"] = MACHINE_ID; // "CUP_001" from config.h
    doc["token"] = qrPayload;
    
    String requestBody;
    serializeJson(doc, requestBody);

    Serial.println(">>> [verifyOrder] Request Payload Built. Using Native HTTPS POST... <<<");
    diagnostics.info(ModuleID::System, (String("POST /api/validate-token ") + requestBody).c_str());

    // Helper to send AT and print response asynchronously
    int dotCount = 0;
    auto sendRawAT = [&dotCount](const String& cmd, uint32_t waitMs = 1000, bool animateDots = false) -> String {
        Serial.print(">> " + cmd + "\n<< ");
        SerialAT.println(cmd);
        
        uint32_t startMs = millis();
        uint32_t lastDotMs = millis();
        String resp = "";
        
        while (millis() - startMs < waitMs) {
            while (SerialAT.available()) {
                char c = SerialAT.read();
                resp += c;
                Serial.write(c);
            }
            
            // Check for early completion
            bool isHttpAction = (cmd.indexOf("HTTPACTION") != -1);
            bool hasActionResponse = (resp.indexOf("+HTTPACTION:") != -1);
            bool hasStandardResponse = (resp.indexOf("OK\r\n") != -1 || resp.indexOf("ERROR\r\n") != -1);
            
            // If it's an HTTPACTION, we MUST wait for the +HTTPACTION string.
            // If it's a standard command, we break on OK or ERROR.
            if ((isHttpAction && hasActionResponse) || (!isHttpAction && hasStandardResponse) || (isHttpAction && resp.indexOf("ERROR\r\n") != -1)) {
                delay(100); // grab any lingering characters
                while (SerialAT.available()) {
                    char c = SerialAT.read();
                    resp += c;
                    Serial.write(c);
                }
                break;
            }
            
            // Animate dots without blocking or flickering!
            if (animateDots && millis() - lastDotMs > 500) {
                lastDotMs = millis();
                dotCount = (dotCount + 1) % 4;
                String msg = "Validating";
                for(int i = 0; i < dotCount; i++) msg += ".";
                displayManager.updateStatus(msg.c_str());
            }
            
            esp_task_wdt_reset();
            delay(10);
        }
        return resp;
    };

    sendRawAT("AT+HTTPTERM");

    // Configure SSL Context 0
    sendRawAT("AT+CSSLCFG=\"ignoreretc\",0,1");
    // Enable SNI specifically for A7670 series firmware
    sendRawAT("AT+CSSLCFG=\"enableSNI\",0,1");

    String initResp = sendRawAT("AT+HTTPINIT");
    
    if (initResp.indexOf("ERROR") != -1) {
        Serial.println(">>> [verifyOrder] HTTPINIT Failed! Raw response above. <<<");
        failReason = "Modem Init Failed";
        return false;
    }

    // Tell HTTP stack to use SSL Context 0
    sendRawAT("AT+HTTPPARA=\"SSLCFG\",0");
    
    // Use HTTPS now that SNI is properly configured
    String url = String("https://") + "cupos.in" + "/api/validate-token";
    sendRawAT("AT+HTTPPARA=\"URL\",\"" + url + "\"");
    sendRawAT("AT+HTTPPARA=\"CONTENT\",\"application/json\"");
    sendRawAT("AT+HTTPPARA=\"USERDATA\",\"User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)\\r\\nAccept: */*\\r\\n\"");
    
    Serial.print(">> AT+HTTPDATA=" + String(requestBody.length()) + ",10000\n<< ");
    SerialAT.println("AT+HTTPDATA=" + String(requestBody.length()) + ",10000");
    delay(500);
    esp_task_wdt_reset();
    while (SerialAT.available()) Serial.write(SerialAT.read());

    Serial.print(">> [Sending Body]\n<< ");
    SerialAT.print(requestBody);
    delay(1000);
    esp_task_wdt_reset();
    while (SerialAT.available()) Serial.write(SerialAT.read());

    Serial.println(">>> [verifyOrder] Executing POST Action... <<<");
    String actionResp = sendRawAT("AT+HTTPACTION=1", 15000, true);
    
    int status = 0;
    int dataLen = 0;
    
    if (actionResp.indexOf("+HTTPACTION:") != -1) {
        // Find the start of the values (+HTTPACTION: 1,403,93)
        int startIdx = actionResp.indexOf("+HTTPACTION: ") + 13;
        int firstComma = actionResp.indexOf(",", startIdx);
        int secondComma = actionResp.indexOf(",", firstComma + 1);
        
        if (startIdx > 12 && firstComma != -1 && secondComma != -1) {
            status = actionResp.substring(firstComma + 1, secondComma).toInt();
            dataLen = actionResp.substring(secondComma + 1).toInt();
        }
        Serial.println(">>> [verifyOrder] HTTPACTION parsed: HTTP " + String(status) + ", len=" + String(dataLen) + " <<<");
    } else {
        Serial.println(">>> [verifyOrder] HTTPACTION Failed or Timeout! <<<");
        sendRawAT("AT+HTTPTERM");
        failReason = "Network Timeout";
        return false;
    }

    Serial.println(">>> [verifyOrder] Reading Response... <<<");
    String readResp = "";
    if (dataLen > 0) {
        readResp = sendRawAT("AT+HTTPREAD=0," + String(dataLen), 2000);
    }
    
    // Extract JSON from response (very basic)
    String responseBody = "";
    int jsonStart = readResp.indexOf("{");
    int jsonEnd = readResp.lastIndexOf("}");
    if (jsonStart != -1 && jsonEnd != -1) {
        responseBody = readResp.substring(jsonStart, jsonEnd + 1);
    }
    
    Serial.println(">>> [verifyOrder] Body: " + responseBody + " <<<");

    sendRawAT("AT+HTTPTERM");

    int statusCode = status;

    diagnostics.info(ModuleID::System, (String("HTTP ") + String(statusCode) + " : " + responseBody).c_str());

    if (statusCode == 200) {
        JsonDocument resDoc;
        DeserializationError error = deserializeJson(resDoc, responseBody);
        
        if (!error && resDoc["success"] == true) {
            if (resDoc.containsKey("relay_id")) {
                // Fully dynamic routing from Cloud!
                productId = resDoc["relay_id"].as<uint8_t>();
                durationMs = resDoc["dispense_time_ms"].as<uint16_t>();
                productName = resDoc["product"].as<String>();
                isHalf = resDoc["is_half"].as<bool>();
            } else {
                // Legacy hardcoded fallback
                String product = resDoc["product"].as<String>();
                product.toLowerCase();
                
                if (product == "coffee" || product == "espresso") {
                    productId = 0; // Bev 1
                    durationMs = 300;
                    productName = "Coffee";
                } else if (product == "cappuccino") {
                    productId = 1; // Bev 2
                    durationMs = 300;
                    productName = "Cappuccino";
                } else if (product == "tea" || product == "green tea") {
                    productId = 2; // Bev 3
                    durationMs = 300;
                    productName = "Tea";
                } else {
                    productId = 3; // Bev 4
                    durationMs = 300;
                    productName = product;
                }
                isHalf = false; // Legacy fallback
            }
            
            diagnostics.info(ModuleID::System, "Order Validated!");
            return true;
        } else {
            if (resDoc.containsKey("reason")) {
                failReason = resDoc["reason"].as<String>();
            } else {
                failReason = "Order Rejected";
            }
            diagnostics.error(ModuleID::System, (String("Invalid Token: ") + failReason).c_str());
            return false;
        }
    } else if (statusCode == 403) {
        failReason = "Firewall Blocked";
        return false;
    } else {
        failReason = "Server Error " + String(statusCode);
        diagnostics.error(ModuleID::System, "Server communication failed");
        return false;
    }
}

bool Network::isConnected() {
    return modem.isNetworkConnected();
}

void Network::reconnect() {
    begin();
}
