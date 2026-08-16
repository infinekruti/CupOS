#ifndef NETWORK_H
#define NETWORK_H

#include <Arduino.h>

class Network {
public:
    Network(const char* host, uint16_t port);
    void begin();
    bool verifyOrder(const String& qrPayload, uint8_t& productId, uint16_t& durationMs, String& productName, bool& isHalf, String& failReason);
    bool sendHeartbeat();
    bool isConnected();
    void reconnect();
    uint32_t getLastCommTime() const { return _lastCommTime; }
private:
    const char* _host;
    uint16_t    _port;
    uint32_t    _lastCommTime = 0;
};

#endif
