#pragma once
#include <Arduino.h>
#include <Wire.h>

// Simple driver for PCF8574 I2C expander
// Supports setting pin direction (output) and writing a value.
// For this project we only need to write (set outputs).

class PCF8574 {
public:
    PCF8574(uint8_t address);
    void begin();                     // initialise I2C (call once)
    void writePin(uint8_t pin, bool value); // set pin high/low (0‑7)
    uint8_t read();                    // read all 8 bits
private:
    uint8_t _addr;
    uint8_t _state; // cached output state
};

// Helper functions used in main.cpp (C‑style wrappers)
void PCF8574_init(uint8_t address);
void PCF8574_write(uint8_t address, uint8_t pin, bool value);

// High‑level helpers for PCF8574 #1 – Beverage relays
enum BeverageRelay { BEV_COFFEE = 0, BEV_TEA = 1, BEV_3 = 2, BEV_4 = 3, HALF_CUP = 4, SPARE = 5 };
void PCF1_setBeverageRelay(BeverageRelay bev, bool on);

// High‑level helpers for PCF8574 #2 – Shutter mechanism
void PCF2_setShutterIn1(bool on);
void PCF2_setShutterIn2(bool on);
