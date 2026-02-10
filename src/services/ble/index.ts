/**
 * BLE (Bluetooth Low Energy) Service Module
 *
 * Barrel re-export for BLE connection management and vital sign parsing.
 * Import from 'services/ble' or 'services/ble/bleConnectionManager'.
 */

export { bleConnectionManager } from './bleConnectionManager';
export {
  parseBloodPressure,
  parseGlucose,
  parsePulseOximeter,
  parseWeightScale,
  parseThermometer,
  parseSfloat,
  dataViewToHex,
} from './bleVitalParsers';
