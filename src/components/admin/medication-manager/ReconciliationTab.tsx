/**
 * ReconciliationTab — Medication reconciliation queue
 * Extracted from MedicationManager for decomposition
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { FileText, CheckCircle } from 'lucide-react';
import type { ReconciliationTask } from './MedicationManager.types';
import { getPriorityColor } from './MedicationManagerHelpers';

interface ReconciliationTabProps {
  tasks: ReconciliationTask[];
  onAction: (taskId: string, action: 'start' | 'complete' | 'escalate') => void;
}

export const ReconciliationTab: React.FC<ReconciliationTabProps> = ({ tasks, onAction }) => {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Medication Reconciliation Queue
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {tasks.map(task => (
              <div key={task.id} className="p-4 border rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium">{task.patientName}</div>
                    <div className="text-sm text-gray-600 capitalize">
                      {task.reason.replace('_', ' ')} review
                    </div>
                    <div className="text-sm text-gray-500">
                      {task.medicationChanges} medication changes
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className={`px-2 py-1 text-xs rounded-sm ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    <Badge variant={task.status === 'completed' ? 'default' : 'secondary'}>
                      {task.status.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="text-xs text-gray-500">
                    Due: {new Date(task.dueDate).toLocaleDateString()}
                  </div>
                  <div className="flex gap-2">
                    {task.status === 'pending' && (
                      <Button size="sm" onClick={() => onAction(task.id, 'start')}>
                        Start Review
                      </Button>
                    )}
                    {task.status === 'in_progress' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => onAction(task.id, 'escalate')}>
                          Escalate
                        </Button>
                        <Button size="sm" onClick={() => onAction(task.id, 'complete')}>
                          Complete
                        </Button>
                      </>
                    )}
                    {task.status === 'completed' && (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    )}
                  </div>
                </div>
              </div>
            ))}
            {tasks.length === 0 && (
              <div className="text-center text-gray-500 py-8">
                No pending reconciliation tasks
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReconciliationTab;
