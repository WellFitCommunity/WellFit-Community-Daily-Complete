/**
 * FHIR Prior Authorization Service - Barrel Export
 * CMS-0057-F Compliant Prior Authorization API
 *
 * Maintains backward compatibility with the original monolithic service.
 * All methods are available via the PriorAuthorizationService class.
 *
 * @see https://hl7.org/fhir/us/davinci-pas/
 */

// Re-export all types
export type {
  PriorAuthStatus,
  PriorAuthUrgency,
  PriorAuthDecisionType,
  AppealStatus,
  PriorAuthServiceLine,
  PriorAuthorization,
  PriorAuthDecision,
  PriorAuthAppeal,
  PriorAuthDocument,
  PriorAuthStatusHistory,
  PriorAuthStatistics,
  PriorAuthClaimCheck,
  FHIRApiResponse,
  CreatePriorAuthInput,
  SubmitPriorAuthInput,
  RecordDecisionInput,
  CreateAppealInput,
} from './types';

// Import sub-modules
import * as CRUDService from './PriorAuthCRUDService';
import * as WorkflowService from './PriorAuthWorkflowService';
import * as DecisionService from './PriorAuthDecisionService';
import * as AnalyticsService from './PriorAuthAnalyticsService';
import * as FHIRService from './PriorAuthFHIRService';

/**
 * Backward-compatible class that delegates to focused sub-modules.
 * Existing code using `PriorAuthorizationService.create(...)` continues to work.
 */
export class PriorAuthorizationService {
  // CRUD Operations
  static create = CRUDService.create;
  static getById = CRUDService.getById;
  static getByAuthNumber = CRUDService.getByAuthNumber;
  static getByPatient = CRUDService.getByPatient;
  static getPending = CRUDService.getPending;
  static update = CRUDService.update;
  static addServiceLines = CRUDService.addServiceLines;
  static getServiceLines = CRUDService.getServiceLines;
  static addDocument = CRUDService.addDocument;
  static getDocuments = CRUDService.getDocuments;
  static getStatusHistory = CRUDService.getStatusHistory;

  // Workflow Operations
  static submit = WorkflowService.submit;
  static cancel = WorkflowService.cancel;

  // Decision & Appeal Operations
  static recordDecision = DecisionService.recordDecision;
  static getDecisions = DecisionService.getDecisions;
  static createAppeal = DecisionService.createAppeal;
  static submitAppeal = DecisionService.submitAppeal;
  static getAppeals = DecisionService.getAppeals;

  // Analytics & Reporting
  static getStatistics = AnalyticsService.getStatistics;
  static getApproachingDeadline = AnalyticsService.getApproachingDeadline;
  static checkForClaim = AnalyticsService.checkForClaim;

  // FHIR Resource Conversion
  static toFHIRClaimResource = FHIRService.toFHIRClaimResource;
  static toFHIRClaimResponseResource = FHIRService.toFHIRClaimResponseResource;
}

export default PriorAuthorizationService;
