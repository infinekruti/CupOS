// File: pcf8574.cpp – implementation of a minimal PCF8574 I2C expander driver
#include "pcf8574.h"
#include "config.h"

// Static array to hold up to two driver instances (addresses 0x20 and 0x21)
static PCF8574* pcf_instances[2] = { nullptr, nullptr };

// ------------------------------------------------------------
// PCF8574 class implementation
// ------------------------------------------------------------
PCF8574::PCF8574(uint8_t address) : _addr(address), _state(0xFF) {}

void PCF8574::begin() {
    // Initialise the expander with all pins high (inputs).
    // The PCF8574 uses active‑low outputs, so writing 1 makes the pin an input.
    Wire.beginTransmission(_addr);
    Wire.write(_state); // 0xFF -> all bits high
    Wire.endTransmission();
}

void PCF8574::writePin(uint8_t pin, bool value) {
    if (pin > 7) return; // safety guard – only 0‑7 are valid
    // Update cached state: PCF8574 pins are active‑low for output.
    // value = true  -> drive low (clear bit)
    // value = false -> high (set bit)
    if (value) {
        _state &= static_cast<uint8_t>(~(1 << pin)); // clear bit -> low
    } else {
        _state |= (1 << pin); // set bit -> high (input/high‑z)
    }
    // Push the new state to the device
    Wire.beginTransmission(_addr);
    Wire.write(_state);
    Wire.endTransmission();
}

uint8_t PCF8574::read() {
    // Request the current 8‑bit port state from the expander
    Wire.requestFrom(_addr, static_cast<uint8_t>(1));
    if (Wire.available()) {
        _state = Wire.read();
    }
    return _state;
}

// ------------------------------------------------------------
// C‑style helper wrappers (used by main.cpp and other modules)
// ------------------------------------------------------------
void PCF8574_init(uint8_t address) {
    if (address == PCF1_ADDRESS) {
        if (!pcf_instances[0]) pcf_instances[0] = new PCF8574(address);
        pcf_instances[0]->begin();
    } else if (address == PCF2_ADDRESS) {
        if (!pcf_instances[1]) pcf_instances[1] = new PCF8574(address);
        pcf_instances[1]->begin();
    }
}

void PCF8574_write(uint8_t address, uint8_t pin, bool value) {
    if (address == PCF1_ADDRESS && pcf_instances[0]) {
        pcf_instances[0]->writePin(pin, value);
    } else if (address == PCF2_ADDRESS && pcf_instances[1]) {
        pcf_instances[1]->writePin(pin, value);
    }
}

// ------------------- High‑level PCF8574 helpers -------------------

// PCF8574 #1 – Beverage relays
void PCF1_setBeverageRelay(BeverageRelay bev, bool on) {
    // Translate enum to pin number (same as defined in config.h)
    uint8_t pin;
    switch (bev) {
        case BEV_COFFEE:   pin = PCF1_BEVERAGE1_RELAY; break;
        case BEV_TEA:      pin = PCF1_BEVERAGE2_RELAY; break;
        case BEV_3:        pin = PCF1_BEVERAGE3_RELAY; break;
        case BEV_4:        pin = PCF1_BEVERAGE4_RELAY; break;
        case HALF_CUP:     pin = PCF1_HALF_CUP_RELAY; break;
        case SPARE:        pin = PCF1_SPARE_RELAY; break;
        default:           return; // unknown
    }
    PCF8574_write(PCF1_ADDRESS, pin, on);
}

// PCF8574 #2 – Shutter motor control (IN1/IN2)
void PCF2_setShutterIn1(bool on) { PCF8574_write(PCF2_ADDRESS, PCF2_SHUTTER_IN1, on); }
void PCF2_setShutterIn2(bool on) { PCF8574_write(PCF2_ADDRESS, PCF2_SHUTTER_IN2, on); }

