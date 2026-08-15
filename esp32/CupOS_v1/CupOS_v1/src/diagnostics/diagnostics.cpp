#include "diagnostics.h"
#include "../config/config.h"

#include <cstring>

Diagnostics diagnostics;

namespace
{
    constexpr const char *LogLevelNames[] =
    {
        "DEBUG",
        "INFO ",
        "WARN ",
        "ERROR"
    };

    constexpr const char *ModuleNames[] =
    {
        "SYSTEM",
        "DISPLAY",
        "STORAGE",
        "AUDIO",
        "GSM",
        "QR",
        "RELAY",
        "CUP",
        "SHUTTER",
        "BEVERAGE",
        "ENGINE",
        "STATE",
        "DIAG"
    };
}

void Diagnostics::begin()
{
#if DEBUG_ENABLED

    Serial.begin(DEBUG_BAUDRATE);

    Serial.println();
    Serial.println("==============================================");
    Serial.println("              CupOS Diagnostics");
    Serial.println("==============================================");

    Serial.print("Firmware : ");
    Serial.println(FW_VERSION);

    Serial.print("Machine  : ");
    Serial.println(MACHINE_ID);

    Serial.println("==============================================");

#endif
}

void Diagnostics::update()
{
#if DEBUG_ENABLED

    LogEntry entry;

    while (dequeue(entry))
    {
        printEntry(entry);
    }

#endif
}

void Diagnostics::debug(ModuleID module, const char *message)
{
    enqueue(LogLevel::Debug, module, message);
}

void Diagnostics::info(ModuleID module, const char *message)
{
    enqueue(LogLevel::Info, module, message);
}

void Diagnostics::warning(ModuleID module, const char *message)
{
    enqueue(LogLevel::Warning, module, message);
}

void Diagnostics::error(ModuleID module, const char *message)
{
    enqueue(LogLevel::Error, module, message);
}

void Diagnostics::enqueue(LogLevel level,
                          ModuleID module,
                          const char *message)
{
#if DEBUG_ENABLED

    LogEntry &entry = queue[head];

    entry.timestamp = millis();

    entry.level = level;

    entry.module = module;

    strncpy(entry.message, message, sizeof(entry.message) - 1);

    entry.message[sizeof(entry.message) - 1] = '\0';

    head = (head + 1) % LOG_QUEUE_SIZE;

    if (head == tail)
    {
        // Queue full.
        // Discard oldest entry.

        tail = (tail + 1) % LOG_QUEUE_SIZE;
    }

#endif
}

bool Diagnostics::dequeue(LogEntry &entry)
{
    if (head == tail)
    {
        return false;
    }

    entry = queue[tail];

    tail = (tail + 1) % LOG_QUEUE_SIZE;

    return true;
}

void Diagnostics::printEntry(const LogEntry &entry)
{
#if DEBUG_ENABLED

    Serial.print('[');
    Serial.print(entry.timestamp);
    Serial.print("] ");

    Serial.print('[');
    Serial.print(LogLevelNames[static_cast<uint8_t>(entry.level)]);
    Serial.print("] ");

    Serial.print('[');
    Serial.print(ModuleNames[static_cast<uint8_t>(entry.module)]);
    Serial.print("] ");

    Serial.println(entry.message);

#endif
}