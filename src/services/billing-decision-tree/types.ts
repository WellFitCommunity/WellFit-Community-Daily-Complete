// Billing Decision Tree - Type Re-exports
// Central location for all billing decision tree types

export type {
  DecisionTreeInput,
  DecisionTreeResult,
  BillableClaimLine,
  DecisionNode,
  ValidationIssue,
  EligibilityCheckResult,
  ServiceClassification,
  ProcedureLookupResult,
  EMEvaluationResult,
  ModifierDecision,
  FeeScheduleResult,
  MedicalNecessityCheck,
  EMDocumentationElements,
  DecisionTreeConfig,
} from '../../types/billingDecisionTree';
