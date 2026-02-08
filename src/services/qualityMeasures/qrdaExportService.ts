/**
 * QRDA Export Service
 *
 * ONC Criteria: 170.315(c)(2), (c)(3)
 * Purpose: Generate QRDA Category I and Category III documents for CMS submission
 *
 * Barrel re-export — all logic lives in export/ submodules.
 */

export type { QRDAExportOptions, QRDAExportResult } from './export/types';
export { exportQRDAI } from './export/qrdaIExport';
export { exportQRDAIII } from './export/qrdaIIIExport';
export { validateQRDADocument, getExportHistory } from './export/qrdaValidation';

import { exportQRDAI } from './export/qrdaIExport';
import { exportQRDAIII } from './export/qrdaIIIExport';
import { validateQRDADocument, getExportHistory } from './export/qrdaValidation';

export const QRDAExportService = {
  exportQRDAI,
  exportQRDAIII,
  validateQRDADocument,
  getExportHistory
};

export default QRDAExportService;
