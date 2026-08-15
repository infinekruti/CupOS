#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

/*====================================================
    CupOS Firmware Information
====================================================*/

#define FW_NAME        "CupOS"
#define FW_VERSION     "1.0.0"

#define MACHINE_ID         "INDORE-001"
#define MACHINE_SECRET_KEY "CupOS_SuperSecret_123"

/*====================================================
    Serial Configuration
====================================================*/

// #define DEBUG_BAUDRATE 115200


/*====================================================
    I2C Configuration
====================================================*/

#define I2C_SDA        21
#define I2C_SCL        22


/*====================================================
    SPI Configuration
====================================================*/

#define SPI_MOSI       23
#define SPI_MISO       19
#define SPI_SCK        18


/*====================================================
    TFT Display
====================================================*/

#define TFT_CS         5
#define TFT_DC         2
#define TFT_RST        4


/*====================================================
    SD Card
====================================================*/

#define SD_CS          13


/*====================================================
    GSM Module
====================================================*/

#define GSM_RX         16
#define GSM_TX         17


/*====================================================
    QR Scanner
====================================================*/

#define QR_RX          32
#define QR_TX          33
constexpr uint32_t QR_BAUDRATE = 9600;


/*====================================================
    Audio (MAX98357A)
====================================================*/

#define I2S_BCLK       25
#define I2S_LRC        26
#define I2S_DOUT       27


/*====================================================
    Cup Servo
====================================================*/

#define CUP_SERVO_PIN  14


/*====================================================
    PCF8574 Addresses
====================================================*/

#define PCF_RELAY      0x20
#define PCF_SHUTTER    0x21


/*====================================================
    Beverage Relays (PCF 0x20)
====================================================*/

#define RELAY_BEV1     0
#define RELAY_BEV2     1
#define RELAY_BEV3     2
#define RELAY_BEV4     3
#define RELAY_HALF     4
#define RELAY_SPARE    5


/*====================================================
    Shutter Control (PCF 0x21)
====================================================*/

#define SHUTTER_IN1        0
#define SHUTTER_IN2        1
#define LIMIT_OPEN         3
#define LIMIT_CLOSE        2

/*====================================================
    Cup Sensors (Direct GPIO)
====================================================*/
#define CUP_SENSOR_1 34
#define CUP_SENSOR_2 35

constexpr bool DEBUG_ENABLED = true;
constexpr uint32_t DEBUG_BAUDRATE = 115200;
constexpr uint8_t LOG_QUEUE_SIZE = 32;
#endif