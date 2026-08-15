#ifndef RELAY_H
#define RELAY_H

#include <Arduino.h>

class Relay
{
public:

    void begin();

    // Beverage Selection
    void beverage1(bool state);
    void beverage2(bool state);
    void beverage3(bool state);
    void beverage4(bool state);

    void halfCup(bool state);

    // Shutter Motor
    void shutterForward();
    void shutterReverse();
    void shutterStop();

    // Inputs
    bool isShutterOpen();
    bool isShutterClosed();

};

extern Relay relay;

#endif