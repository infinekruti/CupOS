#ifndef DIAGNOSTICS_H
#define DIAGNOSTICS_H

#include <Arduino.h>
#include "../config/config.h"

#include "log_entry.h"

class Diagnostics
{
public:

    void begin();

    void update();

    void debug(ModuleID module, const char *message);

    void info(ModuleID module, const char *message);

    void warning(ModuleID module, const char *message);

    void error(ModuleID module, const char *message);

private:

    void enqueue(LogLevel level,
                 ModuleID module,
                 const char *message);

    bool dequeue(LogEntry &entry);

    void printEntry(const LogEntry &entry);

private:

    LogEntry queue[LOG_QUEUE_SIZE];

    uint8_t head = 0;

    uint8_t tail = 0;

};

extern Diagnostics diagnostics;

#endif