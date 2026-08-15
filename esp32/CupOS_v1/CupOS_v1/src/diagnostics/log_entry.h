#ifndef LOG_ENTRY_H
#define LOG_ENTRY_H

#include <Arduino.h>

#include "log_level.h"
#include "module_id.h"

struct LogEntry
{
    uint32_t timestamp;

    LogLevel level;

    ModuleID module;

    char message[96];
};

#endif