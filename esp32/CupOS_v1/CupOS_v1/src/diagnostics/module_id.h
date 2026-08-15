#ifndef MODULE_ID_H
#define MODULE_ID_H

#include <Arduino.h>

enum class ModuleID : uint8_t
{
    System = 0,
    Display,
    Storage,
    Audio,
    GSM,
    QR,
    Relay,
    Cup,
    Shutter,
    Beverage,
    Engine,
    State,
    Diagnostics
};

#endif