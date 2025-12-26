/**
 * ConsentManagementPage - Patient Data Access Control
 *
 * Allows patients to manage who has access to their health data,
 * view connected apps, and review access audit logs.
 *
 * Compliance: 21st Century Cures Act, HIPAA Privacy Rule
 */

import React from 'react';
import { ConsentDashboard } from '../components/patient/ConsentManagement';

const ConsentManagementPage: React.FC = () => {
  return <ConsentDashboard />;
};

export default ConsentManagementPage;
