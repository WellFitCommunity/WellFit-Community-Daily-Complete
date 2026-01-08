// ============================================================================
// Task History Viewer - View past generated tasks with satisfaction ratings
// ============================================================================

import React from 'react';
import { AdminTaskHistory } from '../../types/claudeCareAssistant';

interface Props {
  userId: string;
  history: AdminTaskHistory[];
  limit?: number;
}

const TaskHistoryViewer: React.FC<Props> = ({ userId: _userId, history, limit = 20 }) => {
  const formatRelativeTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const formatTaskType = (taskType: string): string => {
    return taskType
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const renderStars = (rating: number | undefined): React.ReactElement => {
    if (!rating) {
      return <span className="text-gray-400 text-xs">Not rated</span>;
    }

    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <svg
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? 'text-yellow-400' : 'text-gray-300'
            }`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        <span className="ml-2 text-xs text-gray-600">({rating}/5)</span>
      </div>
    );
  };

  const displayHistory = history.slice(0, limit);

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Tasks</h3>

      {displayHistory.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <svg
            className="mx-auto h-10 w-10 text-gray-400 mb-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p>No task history yet</p>
        </div>
      ) : (
        displayHistory.map((task) => (
          <div
            key={task.id}
            className="bg-white border border-gray-200 rounded-md p-3 hover:border-blue-300 transition-colors"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 text-sm">
                  {formatTaskType(task.taskType)}
                </h4>
                <p className="text-xs text-gray-500">
                  {formatRelativeTime(task.createdAt)}
                </p>
              </div>

              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-sm">
                {task.role}
              </span>
            </div>

            {renderStars(task.userSatisfaction)}

            {task.userFeedback && (
              <p className="mt-2 text-xs text-gray-600 italic">"{task.userFeedback}"</p>
            )}

            <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
              <span>{task.tokensUsed || 0} tokens</span>
              {task.executionTimeMs && (
                <span>{(task.executionTimeMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default TaskHistoryViewer;
