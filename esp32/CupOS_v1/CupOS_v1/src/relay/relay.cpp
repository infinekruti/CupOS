#include "relay.h"
#include "../config/config.h"
#include <Wire.h>

Relay relay;

uint8_t pcf_relay_shadow = 0xFF;
uint8_t pcf_shutter_shadow = 0xFF;

static void pcfWriteBit(uint8_t address, uint8_t pin, bool state) {
    uint8_t* shadow = (address == PCF_RELAY) ? &pcf_relay_shadow : &pcf_shutter_shadow;
    
    // Active low: state=true means pin goes LOW (0), state=false means HIGH (1)
    if (state) {
        *shadow &= ~(1 << pin);
    } else {
        *shadow |= (1 << pin);
    }
    
    // Ensure input pins on the shutter PCF always remain HIGH (1) so they can act as inputs
    if (address == PCF_SHUTTER) {
        *shadow |= (1 << LIMIT_OPEN);
        *shadow |= (1 << LIMIT_CLOSE);
    }
    
    Wire.beginTransmission(address);
    Wire.write(*shadow);
    Wire.endTransmission();
}

void Relay::begin()
{
    // Initialize Wire is done in main setup
    
    // Set all pins HIGH (off/input state for PCF8574)
    Wire.beginTransmission(PCF_RELAY);
    Wire.write(0xFF);
    Wire.endTransmission();
    
    Wire.beginTransmission(PCF_SHUTTER);
    Wire.write(0xFF);
    Wire.endTransmission();
}

void Relay::beverage1(bool state) { pcfWriteBit(PCF_RELAY, RELAY_BEV1, state); }
void Relay::beverage2(bool state) { pcfWriteBit(PCF_RELAY, RELAY_BEV2, state); }
void Relay::beverage3(bool state) { pcfWriteBit(PCF_RELAY, RELAY_BEV3, state); }
void Relay::beverage4(bool state) { pcfWriteBit(PCF_RELAY, RELAY_BEV4, state); }
void Relay::halfCup(bool state)   { pcfWriteBit(PCF_RELAY, RELAY_HALF, state); }

void Relay::shutterForward()
{
    pcfWriteBit(PCF_SHUTTER, SHUTTER_IN1, true);
    pcfWriteBit(PCF_SHUTTER, SHUTTER_IN2, false);
}

void Relay::shutterReverse()
{
    pcfWriteBit(PCF_SHUTTER, SHUTTER_IN1, false);
    pcfWriteBit(PCF_SHUTTER, SHUTTER_IN2, true);
}

void Relay::shutterStop()
{
    pcfWriteBit(PCF_SHUTTER, SHUTTER_IN1, false);
    pcfWriteBit(PCF_SHUTTER, SHUTTER_IN2, false);
}

bool Relay::isShutterOpen()
{
    Wire.requestFrom(PCF_SHUTTER, (uint8_t)1);
    if (Wire.available()) {
        uint8_t current = Wire.read();
        return (current & (1 << LIMIT_OPEN)) != 0; // NC switch: opens circuit when pressed (reads HIGH)
    }
    return false;
}

bool Relay::isShutterClosed()
{
    Wire.requestFrom(PCF_SHUTTER, (uint8_t)1);
    if (Wire.available()) {
        uint8_t current = Wire.read();
        return (current & (1 << LIMIT_CLOSE)) != 0; // NC switch: opens circuit when pressed (reads HIGH)
    }
    return false;
}