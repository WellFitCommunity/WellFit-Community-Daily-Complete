/**
 * QualityExportPanel — QRDA export controls
 */

import React from 'react';
import { Download, FileText, RefreshCw } from 'lucide-react';

interface QualityExportPanelProps {
  isExporting: boolean;
  exportType: 'QRDA_I' | 'QRDA_III' | null;
  onExport: (type: 'QRDA_I' | 'QRDA_III') => void;
}

export const QualityExportPanel: React.FC<QualityExportPanelProps> = ({
  isExporting,
  exportType,
  onExport,
}) => {
  return (
    <div className="px-6 pb-4 flex gap-3">
      <button
        onClick={() => onExport('QRDA_III')}
        disabled={isExporting}
        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white px-4 py-2 rounded transition-colors"
      >
        {isExporting && exportType === 'QRDA_III' ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <Download className="w-4 h-4" />
        )}
        Export QRDA III (Aggregate)
      </button>
      <button
        onClick={() => onExport('QRDA_I')}
        disabled={isExporting}
        className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 text-white px-4 py-2 rounded transition-colors"
      >
        {isExporting && exportType === 'QRDA_I' ? (
          <RefreshCw className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        Export QRDA I (Patient-Level)
      </button>
    </div>
  );
};
