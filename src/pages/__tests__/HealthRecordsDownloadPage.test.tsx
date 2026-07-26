/**
 * HealthRecordsDownloadPage behavioral tests (L-4)
 *
 * The download flow was a setTimeout mock that shipped literal
 * "PDF content would be here" — the Cures Act patient-access surface. These
 * tests pin the page to the REAL exporters (pdf-health-summary, ccda-export,
 * enhanced-fhir-export) and the failure surface.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';

const invokeMock = vi.fn();
vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'patient-test-alpha-id' } }, error: null,
      }),
    },
  },
}));

const logPhiAccessMock = vi.fn().mockResolvedValue(null);
vi.mock('../../hooks/usePhiAccessLogging', () => ({
  logPhiAccess: (...args: unknown[]) => logPhiAccessMock(...args),
}));

vi.mock('../../services/auditLogger', () => ({
  auditLogger: {
    error: vi.fn().mockResolvedValue(undefined),
    info: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../BrandingContext', () => ({
  useBranding: () => ({
    branding: { gradient: 'none', primaryColor: '#003057' },
  }),
}));

import HealthRecordsDownloadPage from '../HealthRecordsDownloadPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <HealthRecordsDownloadPage />
    </MemoryRouter>
  );
}

describe('HealthRecordsDownloadPage', () => {
  beforeEach(() => {
    invokeMock.mockReset();
    logPhiAccessMock.mockClear();
    // jsdom stubs for the file-download path
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test');
    globalThis.URL.revokeObjectURL = vi.fn();
    window.open = vi.fn(() => null); // force the html-download fallback for pdf
  });

  it('PDF download invokes the real pdf-health-summary generator and logs PHI export', async () => {
    invokeMock.mockResolvedValue({ data: { html: '<html><body>Summary</body></html>' }, error: null });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Download My Records/ }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('pdf-health-summary', {}));
    await screen.findByText('Download Complete!');
    expect(logPhiAccessMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'EXPORT', resourceId: 'patient-test-alpha-id' })
    );
  });

  it('C-CDA download invokes ccda-export and downloads the returned XML', async () => {
    invokeMock.mockResolvedValue({ data: { xml: '<ClinicalDocument/>' }, error: null });
    renderPage();

    fireEvent.click(screen.getByText('C-CDA Document'));
    fireEvent.click(screen.getByRole('button', { name: /Download My Records/ }));

    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith('ccda-export', {}));
    await screen.findByText('Download Complete!');
    expect(globalThis.URL.createObjectURL).toHaveBeenCalled();
  });

  it('FHIR download invokes enhanced-fhir-export with bundle format', async () => {
    invokeMock.mockResolvedValue({ data: { resourceType: 'Bundle', entry: [] }, error: null });
    renderPage();

    fireEvent.click(screen.getByText('FHIR Bundle (JSON)'));
    fireEvent.click(screen.getByRole('button', { name: /Download My Records/ }));

    await waitFor(() =>
      expect(invokeMock).toHaveBeenCalledWith('enhanced-fhir-export', { body: { format: 'bundle' } })
    );
    await screen.findByText('Download Complete!');
  });

  it('shows a failure banner (not silent success) when the exporter errors', async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: /Download My Records/ }));

    await screen.findByText('Download Failed');
    expect(screen.queryByText('Download Complete!')).not.toBeInTheDocument();
  });
});
