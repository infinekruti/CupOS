#ifndef CONFIG_H
#define CONFIG_H

/*************************************************
                CupOS Configuration
*************************************************/

//---------------- Firmware ----------------//

#define FW_NAME        "CupOS"
#define FW_VERSION     "0.1.0"

//---------------- TFT ----------------//

#define TFT_CS         5
#define TFT_DC         2
#define TFT_RST        4

//---------------- SPI ----------------//

#define SPI_MOSI       23
#define SPI_MISO       19
#define SPI_SCK        18

//---------------- SD ----------------//

#define SD_CS          13

//---------------- I2C ----------------//

#define SDA_PIN        21
#define SCL_PIN        22

//---------------- QR Scanner ----------------//

#define QR_RX          32
#define QR_TX          33
#define QR_BAUD        115200

//------------------- Additional Pins -------------------//

// MG996R Servo (Cup Dispenser)
#define SERVO_CUP_PIN   14

// I²S Audio (MAX98357A) – data line (clock lines already defined elsewhere)
#define I2S_DATA_PIN    27



//---------------- GSM ----------------//

#define GSM_RX         16
#define GSM_TX         17
#define GSM_BAUD       115200

//---------------- Audio ----------------//

#define I2S_BCLK       25
#define I2S_LRC        26

//---------------- PCF8574 ----------------//

#define PCF1_ADDRESS   0x20
#define PCF2_ADDRESS   0x21

//------------------- PCF8574 Pin Functions -------------------//

// PCF8574 #1 (0x20) – Beverage Selection & Dispensing
#define PCF1_BEVERAGE1_RELAY   0  // P0 – Coffee
#define PCF1_BEVERAGE2_RELAY   1  // P1 – Tea
#define PCF1_BEVERAGE3_RELAY   2  // P2 – Beverage 3
#define PCF1_BEVERAGE4_RELAY   3  // P3 – Beverage 4
#define PCF1_HALF_CUP_RELAY    4  // P4 – Half Cup Selection
#define PCF1_SPARE_RELAY       5  // P5 – Spare/Utility
// P6, P7 reserved

// PCF8574 #2 (0x21) – Delivery Mechanism
#define PCF2_SHUTTER_IN1       0  // P0 – Shutter Motor IN1
#define PCF2_SHUTTER_IN2       1  // P1 – Shutter Motor IN2
#define PCF2_SHUTTER_OPEN_LS   2  // P2 – Open Limit Switch
#define PCF2_SHUTTER_CLOSE_LS  3  // P3 – Closed Limit Switch
// P4‑P7 reserved

#endif