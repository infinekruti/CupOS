#ifndef LOG_LEVEL_H
#define LOG_LEVEL_H

#include <Arduino.h>

enum class LogLevel : uint8_t
{
    Debug = 0,
    Info,
    Warning,
    Error
};

#endif