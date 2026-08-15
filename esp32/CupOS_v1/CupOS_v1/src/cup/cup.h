#ifndef CUP_H
#define CUP_H

#include <ESP32Servo.h>

class CupDispenser {
public:
    void begin();
    bool dispense();
    bool isCupPresent();
private:
    Servo _servo;
};

extern CupDispenser cupDispenser;

#endif
