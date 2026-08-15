#include "network.h"
#include <WiFi.h>
#include <ArduinoHttpClient.h>
#include <ArduinoJson.h>

Network::Network(const char* host, uint16_t port)
    : _host(host), _port(port) {}

void Network::begin() {
    // Basic Wi-Fi setup - replace with TinyGSM when cellular is needed
    WiFi.begin("CupOS_Test", "password123");
    Serial.print("[Net] Connecting to WiFi");
    
    // Attempt connection for up to 5 seconds
    for(int i = 0; i < 10 && WiFi.status() != WL_CONNECTED; i++) {
        delay(500);
        Serial.print(".");
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[Net] WiFi connected");
    } else {
        Serial.println("\n[Net] WiFi connection failed (running in offline mode)");
    }
}

bool Network::verifyOrder(const String& qrPayload, uint8_t& productId, uint16_t& durationMs) {
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[Net] Network offline, cannot verify order");
        // For testing purposes when offline, we could simulate a success here
        // But for production we return false
        return false;
    }

    JsonDocument doc;
    doc["qr"] = qrPayload;
    String jsonStr;
    serializeJson(doc, jsonStr);

    WiFiClient client;
    HttpClient http(client, _host, _port);
    http.beginRequest();
    http.post("/verify");
    http.sendHeader("Content-Type", "application/json");
    http.sendHeader("Content-Length", jsonStr.length());
    http.endRequest();
    http.write((const uint8_t*)jsonStr.c_str(), jsonStr.length());

    int status = http.responseStatusCode();
    if (status != 200) {
        Serial.printf("[Net] Server error %d\n", status);
        return false;
    }

    String resp = http.responseBody();
    JsonDocument respDoc;
    DeserializationError err = deserializeJson(respDoc, resp);
    if (err) {
        Serial.println("[Net] JSON parse error");
        return false;
    }

    if (respDoc["productId"].isNull() || respDoc["durationMs"].isNull()) {
        return false;
    }

    productId = respDoc["productId"].as<uint8_t>();
    durationMs = respDoc["durationMs"].as<uint16_t>();
    Serial.printf("[Net] Order OK - product %d, duration %d ms\n", productId, durationMs);
    return true;
}
