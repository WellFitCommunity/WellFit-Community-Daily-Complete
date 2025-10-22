/**
 * Guardian Agent - Public API
 * Export all public interfaces and the main agent instance
 */

export { GuardianAgent, getGuardianAgent } from './GuardianAgent';
export { GuardianAgentDashboard } from '../../components/admin/GuardianAgentDashboard';

// Export types for external use
export type {
  ErrorCategory,
  SeverityLevel,
  HealingStrategy,
  ErrorSignature,
  DetectedIssue,
  HealingAction,
  HealingResult,
  AgentState,
  AgentConfig,
  KnowledgeEntry
} from './types';

// Export utility hooks
export {
  useGuardianAgent,
  useIssueMonitor,
  useAgentHealth,
  useAgentStatistics
} from './hooks';

/**
 * Quick start guide:
 *
 * 1. Start the agent in your main App component:
 *
 *    import { getGuardianAgent } from '@/services/guardian-agent';
 *
 *    useEffect(() => {
 *      const agent = getGuardianAgent({
 *        autoHealEnabled: true,
 *        learningEnabled: true,
 *        hipaaComplianceMode: true
 *      });
 *      agent.start();
 *    }, []);
 *
 * 2. View the dashboard (admin only):
 *
 *    import { GuardianAgentDashboard } from '@/services/guardian-agent';
 *
 *    <Route path="/admin/guardian" element={<GuardianAgentDashboard />} />
 *
 * 3. Manually report issues (optional):
 *
 *    import { getGuardianAgent } from '@/services/guardian-agent';
 *
 *    try {
 *      // your code
 *    } catch (error) {
 *      getGuardianAgent().reportIssue(error, { component: 'MyComponent' });
 *    }
 *
 * The agent will automatically:
 * - Monitor for errors and anomalies
 * - Detect security vulnerabilities
 * - Heal issues autonomously
 * - Learn from patterns
 * - Adapt strategies based on success rates
 */
