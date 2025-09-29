import React, { useState } from 'react';
import { ToastContainer, toast } from 'react-toastify';
import { supabase } from '../../lib/supabaseClient';
import 'react-toastify/dist/ReactToastify.css';

interface X12ClaimGeneratorProps {
  encounterId: string;
  billingProviderId: string;
  onClaimGenerated?: (claimId: string, x12Content: string) => void;
}

/**
 * IMPORTANT (CRA):
 * - Do NOT import any server-side generator class here.
 * - This calls your Supabase Edge Function `generate-837p`.
 */
export const X12ClaimGenerator: React.FC<X12ClaimGeneratorProps> = ({
  encounterId,
  billingProviderId,
  onClaimGenerated,
}) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [x12Content, setX12Content] = useState<string>('');
  const [claimId, setClaimId] = useState<string>('');
  const [controlNumber, setControlNumber] = useState<string>('');

  const generateClaim = async () => {
    if (!encounterId || !billingProviderId) {
      toast.error('Missing encounterId or billingProviderId');
      return;
    }

    setIsGenerating(true);
    setX12Content('');
    setClaimId('');
    setControlNumber('');

    try {
      const { data, error } = await supabase.functions.invoke('generate-837p', {
        body: { encounterId, billingProviderId },
      });

      if (error) throw new Error(error.message || 'Edge Function error');

      let x12 = '';
      let returnedClaimId = '';
      let returnedControl = '';

      if (typeof data === 'string') {
        x12 = data;
      } else if (data && typeof data === 'object') {
        // If you later return JSON from the function:
        x12 = data.x12 ?? '';
        returnedClaimId = data.claimId ?? '';
        returnedControl = data.controlNumber ?? '';
      }

      if (!x12) throw new Error('No X12 payload returned');

      const fallbackId = `WF${Date.now()}`;
      setX12Content(x12);
      setClaimId(returnedClaimId || fallbackId);
      setControlNumber(returnedControl || '');

      toast.success('X12 837P claim generated successfully ✅');

      onClaimGenerated?.(returnedClaimId || fallbackId, x12);
    } catch (err: any) {
      console.error('Claim generation failed:', err);
      toast.error(`Failed to generate claim: ${err.message || String(err)}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadX12 = () => {
    if (!x12Content) return;
    const blob = new Blob([x12Content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const filename = `claim_${claimId || controlNumber || 'generated'}.x12.txt`;
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.info(`Downloaded ${filename}`);
  };

  return (
    <div className="border rounded-lg p-6 bg-white">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">X12 837P Claim Generation</h3>
        <div className="space-x-2">
          <button
            onClick={generateClaim}
            disabled={isGenerating}
            className="bg-green-600 text-white px-4 py-2 rounded disabled:bg-gray-400"
          >
            {isGenerating ? 'Generating…' : 'Generate 837P Claim'}
          </button>

          {x12Content && (
            <button
              onClick={downloadX12}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              Download X12 File
            </button>
          )}
        </div>
      </div>

      {(claimId || controlNumber) && (
        <div className="text-sm text-gray-600 mb-2">
          {claimId && <div><strong>Claim ID:</strong> {claimId}</div>}
          {controlNumber && <div><strong>ST Control #:</strong> {controlNumber}</div>}
        </div>
      )}

      {x12Content && (
        <div className="mt-4">
          <h4 className="font-medium mb-2">Generated X12 Content:</h4>
          <pre className="bg-gray-100 p-4 rounded text-xs overflow-auto max-h-96 whitespace-pre-wrap">
{`${x12Content}`}
          </pre>
        </div>
      )}

      <ToastContainer position="bottom-right" />
    </div>
  );
};

export default X12ClaimGenerator;
