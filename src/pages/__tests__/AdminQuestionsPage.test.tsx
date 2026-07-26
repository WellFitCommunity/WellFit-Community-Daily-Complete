/**
 * Tests for AdminQuestionsPage — the deep-linkable tab behavior that the
 * "Risk Assessment" nav button relies on (/admin-questions?tab=assessment must
 * land directly on the Health Assessments tab).
 *
 * Behavior tests (Deletion Test): if the ?tab param handling or the tab-switch
 * logic were removed, these fail. Child managers are mocked to markers so the
 * test isolates the tab-routing logic, not their internals.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router';
import AdminQuestionsPage from '../AdminQuestionsPage';

vi.mock('../../components/admin/RiskAssessmentManager', () => ({
  default: () => <div>RiskAssessmentManager Mock</div>,
}));
vi.mock('../../components/admin/NurseQuestionManager', () => ({
  default: () => <div>NurseQuestionManager Mock</div>,
}));
vi.mock('../../components/smart/RealTimeSmartScribe', () => ({
  default: () => <div>SmartScribe Mock</div>,
}));
vi.mock('../../components/ui/SmartBackButton', () => ({
  default: () => <div>Back</div>,
}));

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/admin-questions" element={<AdminQuestionsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminQuestionsPage — deep-linkable tabs', () => {
  it('?tab=assessment lands directly on the Risk Assessment Manager', () => {
    renderAt('/admin-questions?tab=assessment');
    expect(screen.getByText('RiskAssessmentManager Mock')).toBeInTheDocument();
    expect(screen.queryByText('NurseQuestionManager Mock')).not.toBeInTheDocument();
  });

  it('defaults to the Patient Questions tab when no tab param is present', () => {
    renderAt('/admin-questions');
    expect(screen.getByText('NurseQuestionManager Mock')).toBeInTheDocument();
    expect(screen.queryByText('RiskAssessmentManager Mock')).not.toBeInTheDocument();
  });

  it('falls back to Patient Questions for an invalid tab value', () => {
    renderAt('/admin-questions?tab=bogus');
    expect(screen.getByText('NurseQuestionManager Mock')).toBeInTheDocument();
  });

  it('?tab=scribe lands on the Medical Scribe tab', () => {
    renderAt('/admin-questions?tab=scribe');
    expect(screen.getByText('SmartScribe Mock')).toBeInTheDocument();
  });

  it('clicking the Health Assessments tab switches content to the assessment manager', async () => {
    renderAt('/admin-questions');
    expect(screen.getByText('NurseQuestionManager Mock')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Health Assessments'));

    expect(await screen.findByText('RiskAssessmentManager Mock')).toBeInTheDocument();
    expect(screen.queryByText('NurseQuestionManager Mock')).not.toBeInTheDocument();
  });
});
