#pragma once
#include <Arduino.h>

class Engine {
public:
    Engine() = default;
    void begin();

    bool dispenseCup();
    bool openShutter();
    bool closeShutter();
    void dispenseProduct(uint8_t productId, uint16_t ms, bool isHalf);
    bool isCupPresent();

    void playSound(const char* name);
};
