export interface ErrorMetadata {
  code: string
  title: string
  category: 'CUP' | 'DOOR' | 'SYSTEM' | 'NETWORK'
  severity: 'CRITICAL' | 'WARNING'
  icon: string
  description: string
  troubleshooting: string[]
}

export const ERROR_METADATA: Record<string, ErrorMetadata> = {
  CUP_JAM: {
    code: 'CUP_JAM',
    title: 'Cup Dispenser Jam',
    category: 'CUP',
    severity: 'CRITICAL',
    icon: '🥤',
    description: 'Cup failed to drop after 5 motor attempts or optical sensor did not detect cup presence.',
    troubleshooting: [
      'Open the top cup chute lid and check for bent, crushed, or stuck paper cups.',
      'Check if the cup carousel stack is empty or cup spiral separator is misaligned.',
      'Wipe dust or drink powder off the dual optical IR break-beam sensors at the chute exit.',
      'Verify 5V power supply and signal wire to the MG996R cup drop servo motor.'
    ]
  },
  DOOR_CLOSE_FAILED: {
    code: 'DOOR_CLOSE_FAILED',
    title: 'Shutter Door Close Failure',
    category: 'DOOR',
    severity: 'CRITICAL',
    icon: '🚪',
    description: 'The front dispensing shutter failed to reach the closed limit switch within 7 seconds.',
    troubleshooting: [
      'Inspect shutter door guide tracks for foreign objects, debris, or sticky sugar residue.',
      'Check lower mechanical limit switch (LIMIT_CLOSE) — verify physical contact and wiring click.',
      'Inspect 12V DC motor wiring to H-bridge driver.',
      'Manually slide door with power turned off to verify smooth travel without binding.'
    ]
  },
  DOOR_JAM_OPEN: {
    code: 'DOOR_JAM_OPEN',
    title: 'Shutter Door Open Jam',
    category: 'DOOR',
    severity: 'CRITICAL',
    icon: '🚪',
    description: 'The shutter door failed to open to allow customer to retrieve their prepared beverage.',
    troubleshooting: [
      'Inspect upper limit switch (LIMIT_OPEN) arm and wiring.',
      'Check if door panel is warped or misaligned in the vertical guide rails.',
      'Verify 12V DC motor driver receives forward signal from PCF8574 expander at address 0x21.'
    ]
  },
  SHUTTER_HOMING_FAILED: {
    code: 'SHUTTER_HOMING_FAILED',
    title: 'Door Startup Calibration Failure',
    category: 'DOOR',
    severity: 'CRITICAL',
    icon: '⚠️',
    description: 'During boot self-test, the machine could not calibrate the door to home closed position.',
    troubleshooting: [
      'Verify normally-closed (NC) wiring on limit switches (broken wire safety detection).',
      'Check I2C communication to PCF8574 expander at address 0x21 on SDA (GPIO 21) / SCL (GPIO 22).',
      'Power cycle the machine after clearing any physical obstruction from the door path.'
    ]
  },
  OLD_CUP_NOT_CLEARED: {
    code: 'OLD_CUP_NOT_CLEARED',
    title: 'Dispense Bay Obstructed',
    category: 'SYSTEM',
    severity: 'WARNING',
    icon: '⚠️',
    description: 'An abandoned or previous cup was left in the collection bay and was not removed before a new order.',
    troubleshooting: [
      'Remove abandoned cup or foreign object from the dispensing tray.',
      'Clean optical cup-presence sensor lens with a clean microfiber cloth.'
    ]
  },
  MACHINE_IN_ERROR_STATE: {
    code: 'MACHINE_IN_ERROR_STATE',
    title: 'Machine Halted in Maintenance',
    category: 'SYSTEM',
    severity: 'CRITICAL',
    icon: '🛑',
    description: 'Microcontroller is halted in safety state awaiting technician intervention.',
    troubleshooting: [
      'Inspect physical components and clean the dispensing bay.',
      'Power cycle the machine to execute boot self-test calibration.',
      'Click "Resolve & Set Online" on the admin portal once verified.'
    ]
  }
}

export function getErrorMetadata(errorCode?: string): ErrorMetadata {
  if (!errorCode) {
    return {
      code: 'UNKNOWN_ERROR',
      title: 'Unspecified Hardware Fault',
      category: 'SYSTEM',
      severity: 'WARNING',
      icon: '⚠️',
      description: 'Machine reported a safety error state without a specific code.',
      troubleshooting: [
        'Inspect machine physically for jams or electrical faults.',
        'Power cycle the machine to run startup self-test.'
      ]
    }
  }

  const clean = errorCode.trim().toUpperCase()
  if (ERROR_METADATA[clean]) {
    return ERROR_METADATA[clean]
  }

  if (clean.includes('CUP')) return ERROR_METADATA.CUP_JAM
  if (clean.includes('CLOSE')) return ERROR_METADATA.DOOR_CLOSE_FAILED
  if (clean.includes('OPEN')) return ERROR_METADATA.DOOR_JAM_OPEN
  if (clean.includes('HOMING')) return ERROR_METADATA.SHUTTER_HOMING_FAILED

  return {
    code: clean,
    title: clean.replace(/_/g, ' '),
    category: 'SYSTEM',
    severity: 'CRITICAL',
    icon: '⚠️',
    description: `Diagnostic hardware fault reported: ${clean}`,
    troubleshooting: [
      'Inspect machine physical state and wiring.',
      'Review system logs for related faults.',
      'Power cycle to perform startup diagnostics.'
    ]
  }
}
