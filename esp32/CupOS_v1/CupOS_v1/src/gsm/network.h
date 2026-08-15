#ifndef NETWORK_H
#define NETWORK_H

#include <Arduino.h>

class Network {
public:
    Network(const char* host, uint16_t port);
    void begin();
    bool verifyOrder(const String& qrPayload, uint8_t& productId, uint16_t& durationMs, String& productName, bool& isHalf, String& failReason);
    bool isConnected();
    void reconnect();
private:
    const char* _host;
    uint16_t    _port;
};

#endif
