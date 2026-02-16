/**
 * Clinical Workflow Wizard
 *
 * Step-by-step guidance for multi-step clinical workflows.
 * Reduces clicks by chaining linked tasks (admit -> assign -> care plan -> follow-up)
 * instead of requiring clinicians to navigate between separate dashboards.
 *
 * Persists progress in localStorage per user session.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, ArrowRight, X, Play, RotateCcw } from 'lucide-react';

interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  route?: string;
  sectionId?: string;
  actionLabel: string;
}

interface ClinicalWorkflow {
  id: string;
  name: string;
  icon: string;
  description: string;
  roles: string[];
  steps: WorkflowStep[];
}

const CLINICAL_WORKFLOWS: ClinicalWorkflow[] = [
  {
    id: 'patient-admission',
    name: 'Patient Admission',
    icon: '\uD83C\uDFE5',
    description: 'Admit a new patient: enroll, assign provider, create care plan, schedule follow-up',
    roles: ['nurse', 'physician', 'doctor', 'admin', 'super_admin', 'case_manager'],
    steps: [
      {
        id: 'enroll',
        label: 'Enroll Patient',
        description: 'Create patient record with demographics and insurance',
        route: '/admin/enroll-senior',
        actionLabel: 'Go to Enrollment',
      },
      {
        id: 'assign-provider',
        label: 'Assign Provider',
        description: 'Assign attending, supervising, and consulting providers',
        sectionId: 'provider-assignment',
        actionLabel: 'Open Provider Assignment',
      },
      {
        id: 'care-plan',
        label: 'Create Care Plan',
        description: 'Generate AI-assisted care plan based on diagnosis and SDOH',
        route: '/care-coordination',
        actionLabel: 'Go to Care Coordination',
      },
      {
        id: 'schedule-followup',
        label: 'Schedule Follow-Up',
        description: 'Set discharge follow-up and readmission monitoring',
        route: '/discharge-tracking',
        actionLabel: 'Go to Discharge Tracking',
      },
    ],
  },
  {
    id: 'shift-handoff',
    name: 'Shift Change',
    icon: '\uD83D\uDD04',
    description: 'Complete shift handoff: review patients, generate handoff packet, transfer care',
    roles: ['nurse', 'physician', 'doctor', 'admin', 'super_admin'],
    steps: [
      {
        id: 'review-tasks',
        label: 'Review Pending Tasks',
        description: 'Check your task queue for incomplete items',
        sectionId: 'provider-task-queue',
        actionLabel: 'Open Task Queue',
      },
      {
        id: 'check-results',
        label: 'Acknowledge Results',
        description: 'Review and acknowledge all pending lab/imaging results',
        sectionId: 'unacknowledged-results',
        actionLabel: 'Open Results',
      },
      {
        id: 'generate-handoff',
        label: 'Generate Handoff Packet',
        description: 'AI-assisted shift handoff summary with patient status',
        route: '/shift-handoff',
        actionLabel: 'Go to Shift Handoff',
      },
      {
        id: 'confirm-transfer',
        label: 'Confirm Transfer',
        description: 'Receiving nurse acknowledges patient transfer',
        route: '/handoff/receiving',
        actionLabel: 'Go to Receiving Dashboard',
      },
    ],
  },
  {
    id: 'billing-cycle',
    name: 'Encounter Billing',
    icon: '\uD83D\uDCB0',
    description: 'Complete billing cycle: review superbill, submit claim, track payment',
    roles: ['billing_specialist', 'admin', 'super_admin'],
    steps: [
      {
        id: 'superbill-review',
        label: 'Review Superbill',
        description: 'Provider sign-off on encounter charges and diagnosis codes',
        sectionId: 'superbill-review',
        actionLabel: 'Open Superbill Review',
      },
      {
        id: 'verify-eligibility',
        label: 'Verify Eligibility',
        description: 'Confirm insurance eligibility before claim submission',
        sectionId: 'eligibility-verification',
        actionLabel: 'Open Eligibility Check',
      },
      {
        id: 'submit-claim',
        label: 'Submit Claim',
        description: 'Generate and submit 837P claim to clearinghouse',
        sectionId: 'claims-submission',
        actionLabel: 'Open Claims Submission',
      },
      {
        id: 'track-payment',
        label: 'Track Payment',
        description: 'Monitor claim status and post ERA remittance',
        sectionId: 'era-payment-posting',
        actionLabel: 'Open Payment Posting',
      },
    ],
  },
  {
    id: 'readmission-prevention',
    name: 'Readmission Prevention',
    icon: '\uD83D\uDEE1\uFE0F',
    description: 'Review high-risk patients, close care gaps, and schedule outreach',
    roles: ['nurse', 'physician', 'doctor', 'case_manager', 'social_worker', 'admin', 'super_admin'],
    steps: [
      {
        id: 'review-risk',
        label: 'Review High-Risk Patients',
        description: 'Identify patients with elevated readmission risk scores',
        route: '/readmissions',
        actionLabel: 'Go to Readmissions',
      },
      {
        id: 'close-care-gaps',
        label: 'Close Care Gaps',
        description: 'Address preventive care gaps for at-risk patients',
        sectionId: 'care-gap-detection',
        actionLabel: 'Open Care Gap Detection',
      },
      {
        id: 'check-engagement',
        label: 'Check Engagement',
        description: 'Verify patient is completing daily check-ins and taking meds',
        sectionId: 'patient-engagement',
        actionLabel: 'Open Engagement Dashboard',
      },
      {
        id: 'schedule-outreach',
        label: 'Schedule Follow-Up',
        description: 'Set up post-discharge follow-up call or visit',
        route: '/care-coordination',
        actionLabel: 'Go to Care Coordination',
      },
    ],
  },
];

const STORAGE_KEY = 'clinical_workflow_progress';

interface WorkflowProgress {
  workflowId: string;
  completedSteps: string[];
  startedAt: string;
}

function loadProgress(): WorkflowProgress[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) as WorkflowProgress[] : [];
  } catch {
    return [];
  }
}

function saveProgress(progress: WorkflowProgress[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

interface WorkflowWizardModalProps {
  workflow: ClinicalWorkflow;
  onClose: () => void;
}

const WorkflowWizardModal: React.FC<WorkflowWizardModalProps> = ({ workflow, onClose }) => {
  const navigate = useNavigate();
  const [progress, setProgress] = useState<WorkflowProgress>(() => {
    const all = loadProgress();
    return all.find(p => p.workflowId === workflow.id) || {
      workflowId: workflow.id,
      completedSteps: [],
      startedAt: new Date().toISOString(),
    };
  });

  const persistProgress = useCallback((updated: WorkflowProgress) => {
    setProgress(updated);
    const all = loadProgress().filter(p => p.workflowId !== workflow.id);
    saveProgress([...all, updated]);
  }, [workflow.id]);

  const toggleStep = useCallback((stepId: string) => {
    const completed = progress.completedSteps.includes(stepId)
      ? progress.completedSteps.filter(id => id !== stepId)
      : [...progress.completedSteps, stepId];
    persistProgress({ ...progress, completedSteps: completed });
  }, [progress, persistProgress]);

  const resetProgress = useCallback(() => {
    const fresh: WorkflowProgress = {
      workflowId: workflow.id,
      completedSteps: [],
      startedAt: new Date().toISOString(),
    };
    persistProgress(fresh);
  }, [workflow.id, persistProgress]);

  const handleNavigate = useCallback((step: WorkflowStep) => {
    if (step.route) {
      navigate(step.route);
    } else if (step.sectionId) {
      const element = document.getElementById(`section-${step.sectionId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        element.classList.add('ring-2', 'ring-teal-500');
        setTimeout(() => element.classList.remove('ring-2', 'ring-teal-500'), 2000);
      } else {
        const sectionElement = document.querySelector(`[data-section-id="${step.sectionId}"]`);
        if (sectionElement) {
          sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }
  }, [navigate]);

  const completedCount = progress.completedSteps.length;
  const totalSteps = workflow.steps.length;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{workflow.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{workflow.name}</h2>
              <p className="text-sm text-gray-500">{workflow.description}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" aria-label="Close">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600">{completedCount}/{totalSteps} steps complete</span>
            <span className="font-medium text-teal-700">{progressPct}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-teal-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="px-6 py-4 space-y-3">
          {workflow.steps.map((step, index) => {
            const isComplete = progress.completedSteps.includes(step.id);
            return (
              <div
                key={step.id}
                className={`rounded-xl border-2 p-4 transition-all ${
                  isComplete
                    ? 'border-green-200 bg-green-50/50'
                    : 'border-gray-200 bg-white hover:border-teal-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleStep(step.id)}
                    className="mt-0.5 flex-shrink-0"
                    aria-label={isComplete ? `Mark "${step.label}" incomplete` : `Mark "${step.label}" complete`}
                  >
                    {isComplete ? (
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    ) : (
                      <Circle className="w-6 h-6 text-gray-300" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-400">Step {index + 1}</span>
                    </div>
                    <h3 className={`font-semibold ${isComplete ? 'text-green-800 line-through' : 'text-gray-900'}`}>
                      {step.label}
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">{step.description}</p>
                  </div>
                  <button
                    onClick={() => handleNavigate(step)}
                    className="flex-shrink-0 px-3 py-1.5 bg-teal-600 text-white text-sm font-medium rounded-lg hover:bg-teal-700 transition-colors flex items-center gap-1"
                  >
                    {step.actionLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={resetProgress}
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset Progress
          </button>
          {completedCount === totalSteps && (
            <span className="text-sm font-medium text-green-700">All steps complete!</span>
          )}
        </div>
      </div>
    </div>
  );
};

interface ClinicalWorkflowWizardProps {
  userRole: string;
}

const ClinicalWorkflowWizard: React.FC<ClinicalWorkflowWizardProps> = ({ userRole }) => {
  const [activeWorkflow, setActiveWorkflow] = useState<ClinicalWorkflow | null>(null);

  const availableWorkflows = useMemo(() =>
    CLINICAL_WORKFLOWS.filter(w => w.roles.includes(userRole)),
    [userRole]
  );

  if (availableWorkflows.length === 0) return null;

  return (
    <>
      <div className="bg-linear-to-r from-teal-50 to-cyan-50 rounded-xl border-2 border-teal-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Play className="w-5 h-5 text-teal-700" />
          <h3 className="text-lg font-bold text-teal-900">Clinical Workflows</h3>
          <span className="text-xs text-teal-600">Step-by-step guides</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {availableWorkflows.map(workflow => {
            const progress = loadProgress().find(p => p.workflowId === workflow.id);
            const completedCount = progress?.completedSteps.length || 0;
            const totalSteps = workflow.steps.length;
            const hasProgress = completedCount > 0 && completedCount < totalSteps;

            return (
              <button
                key={workflow.id}
                onClick={() => setActiveWorkflow(workflow)}
                className="bg-white rounded-xl p-4 text-left shadow-sm border border-teal-100 hover:border-teal-300 hover:shadow-md transition-all group"
              >
                <span className="text-2xl">{workflow.icon}</span>
                <h4 className="font-semibold text-gray-900 mt-2 group-hover:text-teal-700 transition-colors">
                  {workflow.name}
                </h4>
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{workflow.description}</p>
                {hasProgress && (
                  <div className="mt-2">
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div
                        className="bg-teal-500 h-1.5 rounded-full"
                        style={{ width: `${Math.round((completedCount / totalSteps) * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-teal-600 mt-1">{completedCount}/{totalSteps} done</span>
                  </div>
                )}
                {completedCount === totalSteps && totalSteps > 0 && (
                  <span className="text-xs text-green-600 mt-2 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Complete
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {activeWorkflow && (
        <WorkflowWizardModal
          workflow={activeWorkflow}
          onClose={() => setActiveWorkflow(null)}
        />
      )}
    </>
  );
};

export default ClinicalWorkflowWizard;
