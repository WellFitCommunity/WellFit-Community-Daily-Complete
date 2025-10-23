/**
 * Workflow Template Registry
 * Centralized registry of all specialist workflow templates
 */

import { SpecialistWorkflow } from '../types';
import { chwWorkflow } from './chwTemplate';
import { agHealthWorkflow } from './agHealthTemplate';
import { matWorkflow } from './matTemplate';
import { woundCareWorkflow } from './woundCareTemplate';
import { geriatricWorkflow } from './geriatricTemplate';
import { telepsychWorkflow } from './telepsychTemplate';
import { respiratoryWorkflow } from './respiratoryTemplate';

export class WorkflowTemplateRegistry {
  private templates: Map<string, SpecialistWorkflow> = new Map();

  constructor() {
    this.registerDefaults();
  }

  /**
   * Registers default templates
   */
  private registerDefaults(): void {
    this.register(chwWorkflow);
    this.register(agHealthWorkflow);
    this.register(matWorkflow);
    this.register(woundCareWorkflow);
    this.register(geriatricWorkflow);
    this.register(telepsychWorkflow);
    this.register(respiratoryWorkflow);
  }

  /**
   * Registers a workflow template
   */
  register(workflow: SpecialistWorkflow): void {
    this.templates.set(workflow.id, workflow);
    console.log(`[WorkflowRegistry] Registered: ${workflow.name}`);
  }

  /**
   * Gets a workflow template by ID
   */
  get(id: string): SpecialistWorkflow | undefined {
    return this.templates.get(id);
  }

  /**
   * Gets all templates
   */
  getAll(): SpecialistWorkflow[] {
    return Array.from(this.templates.values());
  }

  /**
   * Gets templates by specialist type
   */
  getByType(type: string): SpecialistWorkflow[] {
    return this.getAll().filter(t => t.specialistType === type);
  }

  /**
   * Checks if a template exists
   */
  has(id: string): boolean {
    return this.templates.has(id);
  }

  /**
   * Unregisters a template
   */
  unregister(id: string): boolean {
    return this.templates.delete(id);
  }
}

// Singleton instance
export const workflowRegistry = new WorkflowTemplateRegistry();

// Export all templates
export {
  chwWorkflow,
  agHealthWorkflow,
  matWorkflow,
  woundCareWorkflow,
  geriatricWorkflow,
  telepsychWorkflow,
  respiratoryWorkflow
};
